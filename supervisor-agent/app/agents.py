"""AutoGen agent wiring for the Demo Insurance Corp assistant.

Architecture: a single `AssistantAgent` named `insurance_assistant` that owns
every tool (customer / application / policy / claim / KB / credit check).
Each session keeps its own agent instance; calling `agent.run_stream(task=...)`
runs the agent once per user turn and accumulates context across turns.

This is intentionally a minimum-viable shape. We tried a Swarm of supervisor +
specialists with handoffs, but Gemini's OpenAI-compat endpoint tends to call
the handoff tool without producing any text, which manifested as empty
bubbles and stuck "Thinking..." in the UI. A single agent is reliable across
models and still demonstrates tool use, MCP integration, and KB-grounded
answers.
"""

import logging
import os

from autogen_agentchat.agents import AssistantAgent
from autogen_core.models import ModelFamily
from autogen_ext.models.openai import OpenAIChatCompletionClient

from app.prompts import INSURANCE_ASSISTANT_PROMPT
from app.tools import (
    create_customer,
    create_policy_application,
    get_application_details,
    get_claim_details,
    get_customer,
    get_knowledge_base_article,
    get_policy_details,
    list_customer_claims,
    list_customer_policies,
    search_knowledge_base,
)

logger = logging.getLogger(__name__)


def _build_model_client() -> OpenAIChatCompletionClient:
    """Build a chat-completion client backed by Google Gemini.

    Uses Gemini's OpenAI-compatible endpoint, so we can keep AutoGen's
    OpenAIChatCompletionClient and only swap the base URL + model_info.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("[agents] GEMINI_API_KEY is not set - model calls will fail")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    base_url = os.getenv(
        "GEMINI_BASE_URL",
        "https://generativelanguage.googleapis.com/v1beta/openai/",
    )
    family = ModelFamily.GEMINI_2_5_PRO if "pro" in model else ModelFamily.GEMINI_2_5_FLASH
    return OpenAIChatCompletionClient(
        model=model,
        api_key=api_key,
        base_url=base_url,
        model_info={
            "family": family,
            "function_calling": True,
            "json_output": True,
            "vision": True,
            "structured_output": True,
        },
    )


def build_agent() -> AssistantAgent:
    """Construct a fresh assistant for a session.

    Each session gets its own agent so chat history doesn't leak between users.
    """
    model_client = _build_model_client()

    return AssistantAgent(
        name="insurance_assistant",
        model_client=model_client,
        system_message=INSURANCE_ASSISTANT_PROMPT,
        tools=[
            get_customer,
            create_customer,
            get_application_details,
            create_policy_application,
            get_policy_details,
            list_customer_policies,
            get_claim_details,
            list_customer_claims,
            search_knowledge_base,
            get_knowledge_base_article,
        ],
        reflect_on_tool_use=True,
    )
