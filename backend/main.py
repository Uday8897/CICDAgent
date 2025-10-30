import asyncio
import sys
import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from pydantic.functional_validators import BeforeValidator
from typing_extensions import Annotated
import uvicorn
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
import motor.motor_asyncio

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.agent.graph import MonitoringAgent
from src.utils.config import Config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "github_monitor"

mongo_client = MongoClient(MONGODB_URL)
db = mongo_client[DATABASE_NAME]

async_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
async_db = async_client[DATABASE_NAME]

repositories_collection = db.repositories
monitoring_results_collection = db.monitoring_results

repositories_collection.create_index("url", unique=True)
repositories_collection.create_index("created_at")
monitoring_results_collection.create_index("repo_id")
monitoring_results_collection.create_index("timestamp")

PyObjectId = Annotated[str, BeforeValidator(str)]

class GitHubRepo(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    url: str
    name: str
    owner: str
    access_token: str
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True
    last_monitored: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class MonitoringResult(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    repo_id: PyObjectId
    timestamp: datetime = Field(default_factory=datetime.now)
    status: str
    failed_run_id: Optional[int] = None
    failed_job_id: Optional[int] = None
    root_cause: Optional[str] = None
    fix_applied: bool = False
    commit_sha: Optional[str] = None
    issue_url: Optional[str] = None
    error_message: Optional[str] = None
    logs_snippet: Optional[str] = None
    analysis_data: Optional[dict] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class AddRepoRequest(BaseModel):
    url: str
    access_token: str

class UpdateRepoRequest(BaseModel):
    url: Optional[str] = None
    access_token: Optional[str] = None
    is_active: Optional[bool] = None

class MongoDBManager:
    @staticmethod
    async def get_all_repositories() -> List[GitHubRepo]:
        repos = []
        async for repo in async_db.repositories.find().sort("created_at", -1):
            repos.append(GitHubRepo(**repo))
        return repos

    @staticmethod
    async def get_repository(repo_id: str) -> Optional[GitHubRepo]:
        if not ObjectId.is_valid(repo_id):
            return None
        repo = await async_db.repositories.find_one({"_id": ObjectId(repo_id)})
        return GitHubRepo(**repo) if repo else None

    @staticmethod
    async def create_repository(repo_data: dict) -> GitHubRepo:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(repo_data["url"])
            path_parts = parsed.path.strip('/').split('/')
            
            if len(path_parts) < 2:
                raise ValueError("Invalid GitHub repository URL")
            
            repo_data["owner"] = path_parts[0]
            repo_data["name"] = path_parts[1]
            repo_data["_id"] = ObjectId()
            
            result = await async_db.repositories.insert_one(repo_data)
            created_repo = await async_db.repositories.find_one({"_id": result.inserted_id})
            return GitHubRepo(**created_repo)
        except DuplicateKeyError:
            raise HTTPException(status_code=400, detail="Repository already exists")

    @staticmethod
    async def update_repository(repo_id: str, update_data: dict) -> Optional[GitHubRepo]:
        if not ObjectId.is_valid(repo_id):
            return None
            
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        if not update_data:
            return await MongoDBManager.get_repository(repo_id)
            
        updated_repo = await async_db.repositories.find_one_and_update(
            {"_id": ObjectId(repo_id)},
            {"$set": update_data},
            return_document=True  
        )
        
        return GitHubRepo(**updated_repo) if updated_repo else None

    @staticmethod
    async def delete_repository(repo_id: str) -> bool:
        if not ObjectId.is_valid(repo_id):
            return False
            
        repo_result = await async_db.repositories.delete_one({"_id": ObjectId(repo_id)})
        await async_db.monitoring_results.delete_many({"repo_id": ObjectId(repo_id)})
        return repo_result.deleted_count > 0

    @staticmethod
    async def get_monitoring_results(repo_id: str, limit: int = 50) -> List[MonitoringResult]:
        if not ObjectId.is_valid(repo_id):
            return []
            
        results = []
        async for result in async_db.monitoring_results.find(
            {"repo_id": ObjectId(repo_id)}
        ).sort("timestamp", -1).limit(limit):
            results.append(MonitoringResult(**result))
        return results

    @staticmethod
    async def create_monitoring_result(result_data: dict) -> MonitoringResult:
        result_data["_id"] = ObjectId()
        result_data["repo_id"] = ObjectId(result_data["repo_id"])
        
        result = await async_db.monitoring_results.insert_one(result_data)
        created_result = await async_db.monitoring_results.find_one({"_id": result.inserted_id})
        return MonitoringResult(**created_result)

    @staticmethod
    async def get_all_monitoring_results(limit: int = 100) -> List[MonitoringResult]:
        results = []
        async for result in async_db.monitoring_results.find().sort("timestamp", -1).limit(limit):
            results.append(MonitoringResult(**result))
        return results

    @staticmethod
    async def get_stats() -> dict:
        total_repos = await async_db.repositories.count_documents({})
        active_repos = await async_db.repositories.count_documents({"is_active": True})
        
        total_runs = await async_db.monitoring_results.count_documents({})
        successful_fixes = await async_db.monitoring_results.count_documents({"fix_applied": True})
        failures_detected = await async_db.monitoring_results.count_documents({"status": "failure"})
        
        yesterday = datetime.now().timestamp() - 86400
        recent_activity = await async_db.monitoring_results.count_documents({
            "timestamp": {"$gte": datetime.fromtimestamp(yesterday)}
        })

        return {
            "total_repositories": total_repos,
            "active_repositories": active_repos,
            "total_monitoring_runs": total_runs,
            "successful_fixes": successful_fixes,
            "failures_detected": failures_detected,
            "recent_activity_24h": recent_activity
        }

app = FastAPI(
    title="GitHub Actions Monitoring Agent",
    description="Autonomous CI/CD Monitoring and Remediation System with MongoDB",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def monitor_repository_sync(repo_id: str):
    try:
        if not ObjectId.is_valid(repo_id):
            logger.error(f"Invalid repository ID: {repo_id}")
            return
            
        repo = repositories_collection.find_one({"_id": ObjectId(repo_id)})
        if not repo:
            logger.error(f"Repository not found: {repo_id}")
            return
            
        if not repo.get("is_active", True):
            logger.info(f"Skipping inactive repository: {repo['name']}")
            return

        logger.info(f"Starting monitoring for repository: {repo['name']}")
        
        original_token = os.getenv("GITHUB_TOKEN")
        os.environ["GITHUB_TOKEN"] = repo["access_token"]
        
        try:
            agent = MonitoringAgent()
            result = agent.run(repo["url"])
            
            logger.info(f"Agent execution completed for {repo['name']}")
            
            if result is None:
                logger.warning(f"Agent returned None for {repo['name']}, creating default result")
                result = {
                    "status": "success",
                    "analysis": {
                        "root_cause": "No workflow failures detected",
                        "is_fixable": False
                    }
                }
            elif not isinstance(result, dict):
                logger.warning(f"Agent returned non-dict type for {repo['name']}, creating default result")
                result = {
                    "status": "success", 
                    "analysis": {
                        "root_cause": "Agent returned invalid result type",
                        "is_fixable": False
                    }
                }
            
            monitoring_result = {
                "repo_id": ObjectId(repo_id),
                "status": result.get("status", "success"),
                "failed_run_id": result.get("failed_run_id"),
                "failed_job_id": result.get("failed_job_id"),
                "root_cause": result.get("analysis", {}).get("root_cause", "No failures detected"),
                "fix_applied": result.get("fix_applied", False),
                "commit_sha": result.get("commit_sha"),
                "issue_url": result.get("issue_url"),
                "error_message": result.get("error_message"),
                "logs_snippet": (result.get("raw_logs", "")[:500] 
                               if result.get("raw_logs") else None),
                "analysis_data": result.get("analysis", {}),
                "timestamp": datetime.now()
            }
            
            monitoring_results_collection.insert_one(monitoring_result)
            
            if monitoring_result["status"] == "success":
                logger.info(f"Monitoring completed successfully: {repo['name']}")
            else:
                logger.warning(f"Monitoring completed with issues: {repo['name']} - Status: {monitoring_result['status']}")
            
        except Exception as e:
            logger.error(f"Error during monitoring execution for {repo['name']}: {str(e)}")
            
            error_result = {
                "repo_id": ObjectId(repo_id),
                "status": "error",
                "error_message": str(e),
                "timestamp": datetime.now()
            }
            monitoring_results_collection.insert_one(error_result)
            
        finally:
            if original_token:
                os.environ["GITHUB_TOKEN"] = original_token
            else:
                os.environ.pop("GITHUB_TOKEN", None)
        
        repositories_collection.update_one(
            {"_id": ObjectId(repo_id)},
            {"$set": {"last_monitored": datetime.now()}}
        )
        
    except Exception as e:
        logger.error(f"Critical error monitoring repository {repo_id}: {str(e)}")
        
        error_result = {
            "repo_id": ObjectId(repo_id),
            "status": "error",
            "error_message": f"Critical error: {str(e)}",
            "timestamp": datetime.now()
        }
        monitoring_results_collection.insert_one(error_result)

async def monitor_repository_async(repo_id: str):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, monitor_repository_sync, repo_id)

@app.get("/")
async def read_root():
    return {
        "message": "GitHub Actions Monitoring Agent API", 
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
async def health_check():
    try:
        await async_db.command("ping")
        
        total_repos = await async_db.repositories.count_documents({})
        active_repos = await async_db.repositories.count_documents({"is_active": True})
        
        return {
            "status": "healthy",
            "database": "connected",
            "repositories": {
                "total": total_repos,
                "active": active_repos,
                "paused": total_repos - active_repos
            },
            "timestamp": datetime.now()
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

@app.get("/api/repositories", response_model=List[GitHubRepo])
async def get_repositories():
    try:
        repos = await MongoDBManager.get_all_repositories()
        logger.info(f"Retrieved {len(repos)} repositories")
        return repos
    except Exception as e:
        logger.error(f"Error fetching repositories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching repositories: {str(e)}")

@app.post("/api/repositories", response_model=GitHubRepo)
async def add_repository(request: AddRepoRequest, background_tasks: BackgroundTasks):
    try:
        repo_data = {
            "url": request.url,
            "access_token": request.access_token,
            "is_active": True
        }
        
        repo = await MongoDBManager.create_repository(repo_data)
        
        background_tasks.add_task(monitor_repository_async, str(repo.id))
        
        logger.info(f"Added new repository: {repo.name}")
        
        return repo
    except ValueError as e:
        logger.warning(f"Invalid repository URL: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding repository: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error adding repository: {str(e)}")

@app.get("/api/repositories/{repo_id}", response_model=GitHubRepo)
async def get_repository(repo_id: str):
    repo = await MongoDBManager.get_repository(repo_id)
    if not repo:
        logger.warning(f"Repository not found: {repo_id}")
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo

@app.put("/api/repositories/{repo_id}", response_model=GitHubRepo)
async def update_repository(repo_id: str, request: UpdateRepoRequest):
    try:
        update_data = request.dict(exclude_unset=True)
        
        if 'is_active' in update_data:
            action = "activated" if update_data['is_active'] else "paused"
            logger.info(f"Repository {action}: {repo_id}")
        
        repo = await MongoDBManager.update_repository(repo_id, update_data)
        if not repo:
            logger.warning(f"Repository not found for update: {repo_id}")
            raise HTTPException(status_code=404, detail="Repository not found")
        return repo
    except Exception as e:
        logger.error(f"Error updating repository {repo_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating repository: {str(e)}")

@app.delete("/api/repositories/{repo_id}")
async def delete_repository(repo_id: str):
    success = await MongoDBManager.delete_repository(repo_id)
    if not success:
        logger.warning(f"Repository not found for deletion: {repo_id}")
        raise HTTPException(status_code=404, detail="Repository not found")
    
    logger.info(f"Deleted repository: {repo_id}")
    return {"message": "Repository deleted successfully"}

@app.get("/api/repositories/{repo_id}/results", response_model=List[MonitoringResult])
async def get_repository_results(repo_id: str, limit: int = 50):
    try:
        repo = await MongoDBManager.get_repository(repo_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        results = await MongoDBManager.get_monitoring_results(repo_id, limit)
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching results for {repo_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching results: {str(e)}")

@app.post("/webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    try:
        event_type = request.headers.get("x-github-event")
        
        if event_type not in ["workflow_run", "workflow_job"]:
            logger.info(f"Ignoring unsupported event type: {event_type}")
            return {"status": "ignored", "message": f"Event type '{event_type}' not supported"}
        
        content_type = request.headers.get("content-type", "")
        logger.info(f"Webhook content-type: {content_type}")
        
        payload = None
        
        if "application/json" in content_type:
            try:
                payload = await request.json()
            except Exception as e:
                logger.error(f"JSON parsing failed: {str(e)}")
                return {"status": "error", "message": "Invalid JSON payload"}
                
        elif "application/x-www-form-urlencoded" in content_type:
            try:
                form_data = await request.form()
                payload_str = form_data.get("payload")
                if payload_str:
                    payload = json.loads(payload_str)
                    logger.info("Successfully parsed form-urlencoded payload")
                else:
                    logger.warning("No payload field in form data")
                    return {"status": "error", "message": "No payload found in form data"}
            except Exception as e:
                logger.error(f"Form data parsing failed: {str(e)}")
                return {"status": "error", "message": "Invalid form data"}
        else:
            logger.warning(f"Unsupported content type: {content_type}")
            return {"status": "error", "message": f"Unsupported content type: {content_type}"}
        
        if not payload:
            logger.error("No payload data after parsing")
            return {"status": "error", "message": "No payload data"}
        
        logger.info(f"Webhook received - Event: {event_type}")
        
        repository = payload.get("repository", {})
        owner = repository.get("owner", {}).get("login", "")
        repo_name = repository.get("name", "")
        
        if not owner or not repo_name:
            logger.warning("Could not extract repository information from webhook")
            return {"status": "error", "message": "Could not extract repository information"}
        
        logger.info(f"Processing webhook for repository: {owner}/{repo_name}")
        
        query = {
            "owner": owner.lower(),
            "name": repo_name.lower()
        }
        
        repo = await async_db.repositories.find_one(query)
        
        if not repo:
            repo = await async_db.repositories.find_one({
                "url": {"$regex": f".*{owner}/{repo_name}", "$options": "i"}
            })
        
        if not repo:
            logger.warning(f"Repository not found in database: {owner}/{repo_name}")
            return {"status": "ignored", "message": "Repository not configured for monitoring"}
        
        repo_obj = GitHubRepo(**repo)
        
        if not repo_obj.is_active:
            logger.info(f"Repository monitoring is paused: {repo_obj.name}")
            return {"status": "ignored", "message": "Repository monitoring is paused"}
        
        should_trigger = False
        
        if event_type == "workflow_run":
            workflow_run = payload.get("workflow_run", {})
            status = workflow_run.get("status")
            conclusion = workflow_run.get("conclusion")
            
            if status == "completed":
                should_trigger = True
                logger.info(f"Workflow run completed - Conclusion: {conclusion}")
        
        elif event_type == "workflow_job":
            workflow_job = payload.get("workflow_job", {})
            status = workflow_job.get("status")
            conclusion = workflow_job.get("conclusion")
            
            if status == "completed":
                should_trigger = True
                logger.info(f"Workflow job completed - Conclusion: {conclusion}")
        
        if should_trigger:
            logger.info(f"Triggering monitoring agent for: {repo_obj.name}")
            background_tasks.add_task(monitor_repository_async, str(repo_obj.id))
            
            return {
                "status": "accepted",
                "message": "Monitoring agent triggered",
                "repository_id": str(repo_obj.id),
                "repository_name": repo_obj.name,
                "event_type": event_type
            }
        else:
            logger.info(f"Event doesn't require monitoring: {event_type}")
            return {
                "status": "ignored", 
                "message": f"Event doesn't require monitoring"
            }
            
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        return {"status": "error", "message": f"Webhook processing error: {str(e)}"}


@app.post("/api/repositories/{repo_id}/monitor")
async def trigger_monitoring(repo_id: str, background_tasks: BackgroundTasks):
    try:
        repo = await MongoDBManager.get_repository(repo_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        if not repo.is_active:
            raise HTTPException(status_code=400, detail="Cannot monitor paused repository. Please resume monitoring first.")
        
        logger.info(f"Manual monitoring triggered for: {repo.name}")
        background_tasks.add_task(monitor_repository_async, repo_id)
        return {"message": "Monitoring triggered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering monitoring for {repo_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error triggering monitoring: {str(e)}")

@app.get("/api/monitoring/results", response_model=List[MonitoringResult])
async def get_all_monitoring_results(limit: int = 100, repo_id: Optional[str] = None):
    try:
        if repo_id:
            repo = await MongoDBManager.get_repository(repo_id)
            if not repo:
                raise HTTPException(status_code=404, detail="Repository not found")
            results = await MongoDBManager.get_monitoring_results(repo_id, limit)
        else:
            results = await MongoDBManager.get_all_monitoring_results(limit)
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching monitoring results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching monitoring results: {str(e)}")

@app.get("/api/stats")
async def get_stats():
    try:
        stats = await MongoDBManager.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

@app.get("/api/repositories/{repo_id}/status")
async def get_repository_status(repo_id: str):
    try:
        repo = await MongoDBManager.get_repository(repo_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        recent_results = await MongoDBManager.get_monitoring_results(repo_id, 5)
        
        return {
            "id": repo.id,
            "name": repo.name,
            "is_active": repo.is_active,
            "last_monitored": repo.last_monitored,
            "monitoring_status": "active" if repo.is_active else "paused",
            "recent_results_count": len(recent_results),
            "created_at": repo.created_at
        }
    except Exception as e:
        logger.error(f"Error getting repository status for {repo_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting repository status: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "cli":
        if len(sys.argv) < 3:
            print("Usage: python main.py cli <repo_url>")
            sys.exit(1)
        repo_url = sys.argv[2]
        temp_repo_id = str(ObjectId())
        repo_data = {
            "_id": ObjectId(temp_repo_id),
            "url": repo_url,
            "access_token": os.getenv("GITHUB_TOKEN", ""),
            "name": "temp",
            "owner": "temp",
            "is_active": True,
            "created_at": datetime.now()
        }
        
        repositories_collection.insert_one(repo_data)
        
        monitor_repository_sync(temp_repo_id)
        repositories_collection.delete_one({"_id": ObjectId(temp_repo_id)})
    else:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )