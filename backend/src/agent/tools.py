# src/agent/tools.py
import os
import requests
from github import Github, GithubException
import base64
from datetime import datetime, timedelta

class GitHubTools:
    def __init__(self):
        self.gh = Github(os.getenv("GITHUB_TOKEN"))
    
    def _make_request(self, method, endpoint, **kwargs):
        """Make HTTP request to GitHub API with error handling"""
        url = f"https://api.github.com{endpoint}"
        
        token = os.getenv("GITHUB_TOKEN")
        if token:
            headers = kwargs.get('headers', {})
            headers['Authorization'] = f'token {token}'
            headers['Accept'] = 'application/vnd.github.v3+json'
            kwargs['headers'] = headers
        
        try:
            response = requests.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ API request error: {e}")
            raise Exception(f"GitHub API error: {str(e)}")
    
    def check_workflow_health(self, owner, repo_name):
        """Check workflow health - consider both recent and older runs if no recent ones found"""
        try:
            print(f"🔍 Checking workflow health for {owner}/{repo_name}")
            
            recent_time = (datetime.now() - timedelta(hours=2)).isoformat() + 'Z'
            
            workflows = self._make_request('GET', f'/repos/{owner}/{repo_name}/actions/runs', 
                                        params={
                                            'per_page': 10,
                                            'created': f'>={recent_time}'
                                        })
            
            recent_runs = workflows.get('workflow_runs', [])
            print(f"📊 Found {len(recent_runs)} recent workflow runs (last 2 hours)")
            
            if recent_runs:
                recent_runs = sorted(recent_runs, key=lambda x: x['created_at'], reverse=True)
                
                for run in recent_runs:
                    print(f"🔍 Recent Run {run['id']}: {run['status']} - {run['conclusion']} - {run['created_at']}")
                    
                    # Only consider completed runs
                    if run['status'] == 'completed':
                        if run['conclusion'] == 'failure':
                            print(f"❌ Found recent failed run: {run['id']}")
                            return {
                                "status": "failure",
                                "run_id": run['id'],
                                "job_id": self._get_failed_job_id(owner, repo_name, run['id']),
                                "run_created_at": run['created_at']
                            }
                        elif run['conclusion'] == 'success':
                            print(f"✅ Found recent successful run: {run['id']}")
                            return {"status": "success"}
                        else:
                            print(f"⚠️ Recent run {run['id']} has conclusion: {run['conclusion']}")
                            continue
            
            print("No recent runs found, checking older runs for overall health...")
            all_workflows = self._make_request('GET', f'/repos/{owner}/{repo_name}/actions/runs', 
                                            params={'per_page': 5})
            
            all_runs = all_workflows.get('workflow_runs', [])
            if all_runs:
                latest_run = all_runs[0]  # Get the very latest run regardless of age
                print(f"🔍 Latest overall run {latest_run['id']}: {latest_run['status']} - {latest_run['conclusion']} - {latest_run['created_at']}")
                
                if latest_run['status'] == 'completed':
                    if latest_run['conclusion'] == 'failure':
                        print(f"❌ Latest run failed: {latest_run['id']}")
                        return {
                            "status": "failure", 
                            "run_id": latest_run['id'],
                            "job_id": self._get_failed_job_id(owner, repo_name, latest_run['id']),
                            "run_created_at": latest_run['created_at']
                        }
                    elif latest_run['conclusion'] == 'success':
                        print(f"✅ Latest run successful: {latest_run['id']}")
                        return {"status": "success"}
            
            print("No workflow runs found at all - repository might be new or have no workflows")
            return {"status": "success"} 
                    
        except Exception as e:
            print(f"❌ Error checking workflow health: {e}")
            return {
                "status": "error", 
                "message": str(e)
            }
    
    def _get_failed_job_id(self, owner, repo_name, run_id):
        """Get the ID of the first failed job in a run"""
        try:
            jobs = self._make_request('GET', f'/repos/{owner}/{repo_name}/actions/runs/{run_id}/jobs')
            for job in jobs.get('jobs', []):
                if job['conclusion'] == 'failure':
                    return job['id']
            return None
        except Exception as e:
            print(f"❌ Error getting failed job ID: {e}")
            return None
    
    def fetch_failure_logs(self, owner: str, repo_name: str, job_id: int) -> str:
        try:
            logs_url = f"https://api.github.com/repos/{owner}/{repo_name}/actions/jobs/{job_id}/logs"
            
            token = os.getenv("GITHUB_TOKEN")
            headers = {}
            if token:
                headers['Authorization'] = f'token {token}'
                headers['Accept'] = 'application/vnd.github.v3+json'
            
            response = requests.get(logs_url, headers=headers)
            
            if response.status_code == 200:
                return response.text
            else:
                return f"Failed to fetch logs. Status: {response.status_code}"
                
        except Exception as e:
            print(f"❌ Error fetching logs for job {job_id}: {e}")
            return f"Error fetching logs: {str(e)}"
    
    def get_workflow_file(self, owner: str, repo_name: str, run_id: int) -> dict:
        try:
            run_data = self._make_request('GET', f'/repos/{owner}/{repo_name}/actions/runs/{run_id}')
            
            workflow_path = run_data.get('path', '')
            
            if workflow_path:
                try:
                    file_data = self._make_request('GET', f'/repos/{owner}/{repo_name}/contents/{workflow_path}')
                    
                    if file_data.get('content'):
                        content = base64.b64decode(file_data['content']).decode('utf-8')
                        return {
                            "path": workflow_path,
                            "content": content
                        }
                except Exception as e:
                    print(f"❌ Error getting workflow file {workflow_path}: {e}")
            
            return self._find_workflow_file(owner, repo_name)
            
        except Exception as e:
            print(f"❌ Error getting workflow file: {e}")
            return {"path": "", "content": f"Error: {str(e)}"}
    
    def _find_workflow_file(self, owner, repo_name):
        """Fallback method to find workflow files"""
        try:
            workflows_data = self._make_request('GET', f'/repos/{owner}/{repo_name}/contents/.github/workflows')
            
            for file_info in workflows_data:
                if file_info['name'].endswith(('.yml', '.yaml')):
                    file_data = self._make_request('GET', f'/repos/{owner}/{repo_name}/contents/{file_info["path"]}')
                    content = base64.b64decode(file_data['content']).decode('utf-8')
                    return {
                        "path": file_info["path"],
                        "content": content
                    }
            return {"path": "", "content": "No workflow files found"}
        except Exception as e:
            print(f"❌ Error finding workflow files: {e}")
            return {"path": "", "content": f"Error finding workflow files: {str(e)}"}
    
    def commit_workflow_fix(self, owner: str, repo_name: str, file_path: str, new_content: str, commit_message: str) -> str:
        try:
            repo = self.gh.get_repo(f"{owner}/{repo_name}")
            
            try:
                file = repo.get_contents(file_path)
                update_result = repo.update_file(file_path, commit_message, new_content, file.sha)
                return update_result['commit'].sha
            except GithubException:
                create_result = repo.create_file(file_path, commit_message, new_content)
                return create_result['commit'].sha
                
        except Exception as e:
            print(f"❌ Error committing fix: {e}")
            raise Exception(f"Failed to commit fix: {str(e)}")
    
    def create_github_issue(self, owner: str, repo_name: str, title: str, body: str) -> str:
        try:
            repo = self.gh.get_repo(f"{owner}/{repo_name}")
            issue = repo.create_issue(title=title, body=body)
            return issue.html_url
        except Exception as e:
            print(f"❌ Error creating issue: {e}")
            raise Exception(f"Failed to create issue: {str(e)}")