"""AutoGen underwriting agent factory."""

import logging
import os

from autogen_agentchat.agents import AssistantAgent
from autogen_core.models import ModelFamily
from autogen_ext.models.openai import OpenAIChatCompletionClient

from app.prompts import UNDERWRITING_AGENT_PROMPT
from app.tools import credit_check, get_application, get_customer, update_application_decision

logger = logging.getLogger(__name__)


def _build_model_client() -> OpenAIChatCompletionClient:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("[uw/agent] GEMINI_API_KEY not set")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
    family = ModelFamily.GEMINI_2_5_PRO if "pro" in model else ModelFamily.GEMINI_2_5_FLASH
    return OpenAIChatCompletionClient(
        model=model,
        api_key=api_key,
        base_url=base_url,
        model_info={
            "family": family,
            "function_calling": True,
            "json_output": True,
            "vision": False,
            "structured_output": True,
        },
    )


def build_underwriting_agent() -> AssistantAgent:
    return AssistantAgent(
        name="underwriting_agent",
        model_client=_build_model_client(),
        system_message=UNDERWRITING_AGENT_PROMPT,
        tools=[get_application, get_customer, credit_check, update_application_decision],
        reflect_on_tool_use=False,
    )
