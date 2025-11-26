# src/agent/state.py
from typing import TypedDict, Optional

class AgentState(TypedDict):
    repo_url: str
    owner: str
    repo_name: str
    failed_run_id: Optional[int]
    failed_job_id: Optional[int]
    raw_logs: Optional[str]
    analysis: Optional[dict]
    original_content: Optional[str]
    proposed_fix: Optional[str]
    workflow_file_path: Optional[str]
    commit_sha: Optional[str]
    issue_url: Optional[str]
    error_message: Optional[str]