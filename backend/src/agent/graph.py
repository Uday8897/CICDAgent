# # src/agent/graph.py
# from langgraph.graph import StateGraph, END
# from .state import AgentState
# from .tools import GitHubTools
# from src.llm.client import LLMClient


# class MonitoringAgent:
#     """Agent to monitor GitHub workflow health, analyze failures, and auto-fix if possible."""

#     def __init__(self):
#         self.tools = GitHubTools()
#         self.llm = LLMClient()
#         self.graph = self._build_graph()
#     def _build_graph(self):
#         workflow = StateGraph(AgentState)
#         workflow.add_node("check_health", lambda state: self.check_health(state))
#         workflow.add_node("fetch_logs", lambda state: self.fetch_logs(state))
#         workflow.add_node("analyze_failure", lambda state: self.analyze_failure(state))
#         workflow.add_node("get_original_workflow", lambda state: self.get_original_workflow(state))
#         workflow.add_node("generate_fix", lambda state: self.generate_fix(state))
#         workflow.add_node("commit_fix", lambda state: self.commit_fix(state))
#         workflow.add_node("create_issue", lambda state: self.create_issue(state))
#         workflow.add_node("mark_success", lambda state: self.mark_success(state))

#         workflow.set_entry_point("check_health")
#         workflow.add_conditional_edges(
#             "check_health",
#             lambda state: self.conditional_health_check(state),
#             {
#                 "fetch_logs": "fetch_logs",
#                 "success": "mark_success",
#                 "end": END
#             }
#         )

#         workflow.add_edge("fetch_logs", "analyze_failure")
#         workflow.add_conditional_edges(
#             "analyze_failure",
#             lambda state: self.conditional_analysis(state),
#             {
#                 "get_original_workflow": "get_original_workflow",
#                 "create_issue": "create_issue"
#             }
#         )

#         workflow.add_edge("get_original_workflow", "generate_fix")
#         workflow.add_edge("generate_fix", "commit_fix")
#         workflow.add_edge("commit_fix", END)
#         workflow.add_edge("create_issue", END)
#         workflow.add_edge("mark_success", END)

#         return workflow.compile()

#     def check_health(self, state: AgentState) -> AgentState:
#         """Check workflow health and detect failures."""
#         print(f"Checking health for {state['owner']}/{state['repo_name']}")

#         result = self.tools.check_workflow_health(state["owner"], state["repo_name"])
#         print(f"Health check result: {result}")

#         if result["status"] == "failure":
#             state["failed_run_id"] = result["run_id"]
#             state["failed_job_id"] = result["job_id"]
#             state["health_status"] = "failure"
#             print(f"Failure detected in run {result['run_id']}")
#         elif result["status"] == "error":
#             state["error_message"] = result["message"]
#             state["health_status"] = "error"
#             print(f"Error during health check: {result['message']}")
#         else:
#             state["health_status"] = "success"
#             print("No failures detected - marking as success")

#         return state

#     def fetch_logs(self, state: AgentState) -> AgentState:
#         """Fetch logs for the failed job."""
#         if state.get("failed_job_id"):
#             print(f"📄 Fetching logs for job {state['failed_job_id']}")
#             logs = self.tools.fetch_failure_logs(
#                 state["owner"],
#                 state["repo_name"],
#                 state["failed_job_id"]
#             )
#             state["raw_logs"] = logs
#             print(f"Retrieved {len(logs) if logs else 0} characters of logs")
#         return state

#     def analyze_failure(self, state: AgentState) -> AgentState:
#         """Analyze failure using the LLM."""
#         if state.get("raw_logs"):
#             print("Analyzing failure with LLM...")
#             analysis = self.llm.analyze_failure(state["raw_logs"])
#             state["analysis"] = analysis
#             print(f"Analysis complete: {analysis.get('root_cause', 'Unknown')}")
#         return state

#     def get_original_workflow(self, state: AgentState) -> AgentState:
#         """Retrieve the original workflow file."""
#         if state.get("failed_run_id"):
#             print(f"Getting original workflow file for run {state['failed_run_id']}")
#             workflow_data = self.tools.get_workflow_file(
#                 state["owner"],
#                 state["repo_name"],
#                 state["failed_run_id"]
#             )
#             state["workflow_file_path"] = workflow_data["path"]
#             state["original_content"] = workflow_data["content"]
#             print(f"Workflow file: {workflow_data['path']}")
#         return state

#     def generate_fix(self, state: AgentState) -> AgentState:
#         """Generate a fix suggestion using LLM."""
#         if state.get("original_content") and state.get("analysis"):
#             print("🔧 Generating fix with LLM...")
#             proposed_fix = self.llm.generate_fix(
#                 state["original_content"],
#                 state["analysis"].get("fix_suggestion", "")
#             )
#             state["proposed_fix"] = proposed_fix
#             print("Fix generated")
#         return state

#     def commit_fix(self, state: AgentState) -> AgentState:
#         """Commit the fix to the repository."""
#         if all(key in state for key in ["workflow_file_path", "proposed_fix"]):
#             print(f"Committing fix to {state['workflow_file_path']}")
#             commit_sha = self.tools.commit_workflow_fix(
#                 state["owner"],
#                 state["repo_name"],
#                 state["workflow_file_path"],
#                 state["proposed_fix"],
#                 f"Fix workflow failure: {state['analysis'].get('root_cause', 'Unknown')}"
#             )
#             state["commit_sha"] = commit_sha
#             state["fix_applied"] = True
#             print(f"✅ Fix committed with SHA: {commit_sha}")
#         return state

#     def create_issue(self, state: AgentState) -> AgentState:
#         """Create a GitHub issue for unfixable problems."""
#         print("Creating GitHub issue...")
#         title = f"Workflow Failure: {state.get('analysis', {}).get('root_cause', 'Unknown')}"

#         body = f"""## Workflow Failure Analysis

# **Root Cause:** {state.get('analysis', {}).get('root_cause', 'Unknown')}
# **Error Message:** {state.get('analysis', {}).get('error_message', 'Unknown')}
# **Failed Run ID:** {state.get('failed_run_id', 'Unknown')}

# ### Logs Snippet:


# ### Analysis:
# The automated agent determined this issue is not automatically fixable.

# **Suggested Action:** {state.get('analysis', {}).get('fix_suggestion', 'Manual intervention required.')}"""

#         issue_url = self.tools.create_github_issue(
#             state["owner"],
#             state["repo_name"],
#             title,
#             body
#         )
#         state["issue_url"] = issue_url
#         print(f"Issue created: {issue_url}")
#         return state

#     def mark_success(self, state: AgentState) -> AgentState:
#         """Mark the monitoring run as successful."""
#         print("Marking monitoring as successful")
#         state["health_status"] = "success"
#         state["status"] = "success"
#         state["analysis"] = {
#             "root_cause": "No workflow failures detected",
#             "is_fixable": False,
#             "fix_suggestion": "All workflows are running successfully"
#         }
#         return state
#     def conditional_health_check(self, state: AgentState) -> str:
#         """Determine next step after health check."""
#         if state.get("failed_run_id") is not None:
#             return "fetch_logs"
#         elif state.get("health_status") == "success":
#             return "success"
#         return "end"

#     def conditional_analysis(self, state: AgentState) -> str:
#         """Determine next step after analysis."""
#         if state.get("analysis", {}).get("is_fixable"):
#             return "get_original_workflow"
#         return "create_issue"
#     def run(self, repo_url: str) -> dict:
#         """Main entry point to run the monitoring agent on a repository."""
#         from urllib.parse import urlparse
#         parsed = urlparse(repo_url)
#         path_parts = parsed.path.strip('/').split('/')

#         initial_state: AgentState = {
#             "repo_url": repo_url,
#             "owner": path_parts[0],
#             "repo_name": path_parts[1],
#             "failed_run_id": None,
#             "failed_job_id": None,
#             "raw_logs": None,
#             "analysis": None,
#             "original_content": None,
#             "proposed_fix": None,
#             "workflow_file_path": None,
#             "commit_sha": None,
#             "issue_url": None,
#             "error_message": None,
#             "health_status": None,
#             "status": None,
#             "fix_applied": False
#         }

#         print(f"*********Starting monitoring agent for {repo_url}**********************")

#         try:
#             final_state = self.graph.invoke(initial_state)
#             print(f"Agent completed successfully")

#             # Ensure consistent final status
#             if not final_state.get("status"):
#                 if final_state.get("health_status") == "success":
#                     final_state["status"] = "success"
#                 elif final_state.get("failed_run_id"):
#                     final_state["status"] = "failure"
#                 elif final_state.get("error_message"):
#                     final_state["status"] = "error"
#                 else:
#                     final_state["status"] = "success"

#             print(f"##########Final status: {final_state.get('status')}#####")
#             return final_state

#         except Exception as e:
#             print(f"Agent execution failed: {e}")
#             return {
#                 "status": "error",
#                 "error_message": str(e),
#                 "health_status": "error"
#             }
# src/agent/graph.py
import logging
from langgraph.graph import StateGraph, END
from .state import AgentState
from .tools import GitHubTools
from src.llm.client import LLMClient

logger = logging.getLogger(__name__)


class MonitoringAgent:
    """Agent to monitor GitHub workflow health, analyze failures, and auto-fix if possible."""

    def __init__(self):
        self.tools = GitHubTools()
        self.llm = LLMClient()
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentState)
        workflow.add_node("check_health", lambda state: self.check_health(state))
        workflow.add_node("fetch_logs", lambda state: self.fetch_logs(state))
        workflow.add_node("analyze_failure", lambda state: self.analyze_failure(state))
        workflow.add_node("get_original_workflow", lambda state: self.get_original_workflow(state))
        workflow.add_node("generate_fix", lambda state: self.generate_fix(state))
        workflow.add_node("commit_fix", lambda state: self.commit_fix(state))
        workflow.add_node("create_issue", lambda state: self.create_issue(state))
        workflow.add_node("mark_success", lambda state: self.mark_success(state))

        workflow.set_entry_point("check_health")
        workflow.add_conditional_edges(
            "check_health",
            lambda state: self.conditional_health_check(state),
            {
                "fetch_logs": "fetch_logs",
                "success": "mark_success",
                "end": END
            }
        )

        workflow.add_edge("fetch_logs", "analyze_failure")
        workflow.add_conditional_edges(
            "analyze_failure",
            lambda state: self.conditional_analysis(state),
            {
                "get_original_workflow": "get_original_workflow",
                "create_issue": "create_issue"
            }
        )

        workflow.add_edge("get_original_workflow", "generate_fix")
        workflow.add_edge("generate_fix", "commit_fix")
        workflow.add_edge("commit_fix", END)
        workflow.add_edge("create_issue", END)
        workflow.add_edge("mark_success", END)

        return workflow.compile()

    def check_health(self, state: AgentState) -> AgentState:
        result = self.tools.check_workflow_health(state["owner"], state["repo_name"])
        logger.info(f"Health check result for {state['owner']}/{state['repo_name']}: {result}")

        if result["status"] == "failure":
            state["failed_run_id"] = result["run_id"]
            state["failed_job_id"] = result["job_id"]
            state["health_status"] = "failure"
            logger.warning(f"Failure detected in run {result['run_id']}")
        elif result["status"] == "error":
            state["error_message"] = result["message"]
            state["health_status"] = "error"
            logger.error(f"Error during health check: {result['message']}")
        else:
            state["health_status"] = "success"
            logger.info("No failures detected - marking as success")

        return state

    def fetch_logs(self, state: AgentState) -> AgentState:
        if state.get("failed_job_id"):
            logger.info(f"Fetching logs for job {state['failed_job_id']}")
            logs = self.tools.fetch_failure_logs(
                state["owner"],
                state["repo_name"],
                state["failed_job_id"]
            )
            state["raw_logs"] = logs
            logger.info(f"Retrieved {len(logs) if logs else 0} characters of logs")
        return state

    def analyze_failure(self, state: AgentState) -> AgentState:
        if state.get("raw_logs"):
            logger.info("Analyzing failure with LLM")
            analysis = self.llm.analyze_failure(state["raw_logs"])
            state["analysis"] = analysis
            logger.info(f"Analysis complete: {analysis.get('root_cause', 'Unknown')}")
        return state

    def get_original_workflow(self, state: AgentState) -> AgentState:
        if state.get("failed_run_id"):
            logger.info(f"Getting original workflow file for run {state['failed_run_id']}")
            workflow_data = self.tools.get_workflow_file(
                state["owner"],
                state["repo_name"],
                state["failed_run_id"]
            )
            state["workflow_file_path"] = workflow_data["path"]
            state["original_content"] = workflow_data["content"]
            logger.info(f"Workflow file: {workflow_data['path']}")
        return state

    def generate_fix(self, state: AgentState) -> AgentState:
        if state.get("original_content") and state.get("analysis"):
            logger.info("Generating fix with LLM")
            proposed_fix = self.llm.generate_fix(
                state["original_content"],
                state["analysis"].get("fix_suggestion", "")
            )
            state["proposed_fix"] = proposed_fix
            logger.info("Fix generated successfully")
        return state

    def commit_fix(self, state: AgentState) -> AgentState:
        if all(key in state for key in ["workflow_file_path", "proposed_fix"]):
            logger.info(f"Committing fix to {state['workflow_file_path']}")
            commit_sha = self.tools.commit_workflow_fix(
                state["owner"],
                state["repo_name"],
                state["workflow_file_path"],
                state["proposed_fix"],
                f"Fix workflow failure: {state['analysis'].get('root_cause', 'Unknown')}"
            )
            state["commit_sha"] = commit_sha
            state["fix_applied"] = True
            logger.info(f"Fix committed with SHA: {commit_sha}")
        return state

    def create_issue(self, state: AgentState) -> AgentState:
        logger.info("Creating GitHub issue")
        title = f"Workflow Failure: {state.get('analysis', {}).get('root_cause', 'Unknown')}"

        body = f"""## Workflow Failure Analysis

**Root Cause:** {state.get('analysis', {}).get('root_cause', 'Unknown')}
**Error Message:** {state.get('analysis', {}).get('error_message', 'Unknown')}
**Failed Run ID:** {state.get('failed_run_id', 'Unknown')}

### Logs Snippet:


### Analysis:
The automated agent determined this issue is not automatically fixable.

**Suggested Action:** {state.get('analysis', {}).get('fix_suggestion', 'Manual intervention required.')}"""

        issue_url = self.tools.create_github_issue(
            state["owner"],
            state["repo_name"],
            title,
            body
        )
        state["issue_url"] = issue_url
        logger.info(f"Issue created: {issue_url}")
        return state

    def mark_success(self, state: AgentState) -> AgentState:
        logger.info("Marking monitoring as successful")
        state["health_status"] = "success"
        state["status"] = "success"
        state["analysis"] = {
            "root_cause": "No workflow failures detected",
            "is_fixable": False,
            "fix_suggestion": "All workflows are running successfully"
        }
        return state

    def conditional_health_check(self, state: AgentState) -> str:
        if state.get("failed_run_id") is not None:
            return "fetch_logs"
        elif state.get("health_status") == "success":
            return "success"
        return "end"

    def conditional_analysis(self, state: AgentState) -> str:
        if state.get("analysis", {}).get("is_fixable"):
            return "get_original_workflow"
        return "create_issue"

    def run(self, repo_url: str) -> dict:
        from urllib.parse import urlparse
        parsed = urlparse(repo_url)
        path_parts = parsed.path.strip('/').split('/')

        initial_state: AgentState = {
            "repo_url": repo_url,
            "owner": path_parts[0],
            "repo_name": path_parts[1],
            "failed_run_id": None,
            "failed_job_id": None,
            "raw_logs": None,
            "analysis": None,
            "original_content": None,
            "proposed_fix": None,
            "workflow_file_path": None,
            "commit_sha": None,
            "issue_url": None,
            "error_message": None,
            "health_status": None,
            "status": None,
            "fix_applied": False
        }

        logger.info(f"Starting monitoring agent for {repo_url}")

        try:
            final_state = self.graph.invoke(initial_state)
            logger.info("Agent completed successfully")

            if not final_state.get("status"):
                if final_state.get("health_status") == "success":
                    final_state["status"] = "success"
                elif final_state.get("failed_run_id"):
                    final_state["status"] = "failure"
                elif final_state.get("error_message"):
                    final_state["status"] = "error"
                else:
                    final_state["status"] = "success"

            logger.info(f"Final status: {final_state.get('status')}")
            return final_state

        except Exception as e:
            logger.error(f"Agent execution failed: {e}")
            return {
                "status": "error",
                "error_message": str(e),
                "health_status": "error"
            }