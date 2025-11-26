# src/llm/client.py
import os
import json
import re
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

class LLMClient:
    def __init__(self):
        self.client = ChatGroq(
            groq_api_key="",
            model_name="openai/gpt-oss-20b"
        )
    
    def analyze_failure(self, logs: str) -> dict:
        if "Error fetching logs" in logs or "Failed to fetch logs" in logs:
            return {
                "root_cause": "Logs unavailable - authentication or API issue",
                "error_message": logs,
                "is_fixable": False,
                "fix_suggestion": "Check GitHub token permissions and repository access"
            }
        
        system_prompt = """You are a senior DevOps engineer. Analyze the following GitHub Actions logs. 
        Determine the root cause of the failure. Common causes include: syntax errors in the YAML, 
        package manager failures, version mismatches (e.g., Node.js, Python), or build/test failures. 
        Respond with a JSON object with the following structure: 
        {{
            "root_cause": "description of the root cause",
            "error_message": "the specific error message", 
            "is_fixable": true/false,
            "fix_suggestion": "suggestion for how to fix it"
        }}
        The is_fixable flag should only be true if the error is a clear version mismatch or a simple syntax error in the workflow file itself."""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Logs:\n{logs}")
        ])
        
        chain = prompt | self.client
        response = chain.invoke({"logs": logs})
        
        try:
            content = response.content.strip()
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return json.loads(content)
        except json.JSONDecodeError:
            return {
                "root_cause": "Failed to analyze logs",
                "error_message": "JSON parsing error",
                "is_fixable": False,
                "fix_suggestion": "Manual analysis required"
            }
    
    def generate_fix(self, original_content: str, fix_suggestion: str) -> str:
        system_prompt = """Given the following workflow file and the required fix, please generate the entire new, corrected workflow YAML file. 
        Only output the new YAML file content. Do not include any explanations or markdown formatting."""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Original workflow:\n{original_content}\n\nFix suggestion: {fix_suggestion}")
        ])
        
        chain = prompt | self.client
        response = chain.invoke({
            "original_content": original_content,
            "fix_suggestion": fix_suggestion
        })
        
        content = response.content.strip()
        if "```yaml" in content:
            content = content.split("```yaml")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        return content