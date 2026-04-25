import base64
import os
from openai import OpenAI

from src.resilience import retry_with_backoff
from src.runtime_config import (
    GENERATION_TIMEOUT_SECONDS,
    OPENAI_TIMEOUT_SECONDS,
    RETRY_BASE_DELAY_SECONDS,
    RETRY_MAX_ATTEMPTS,
    RETRY_MAX_DELAY_SECONDS,
)


def _encode_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_text_from_image(image_path: str) -> str:
    """
    Vision-LLM reasoning over diagrams, screenshots, architecture images.
    """

    image_b64 = _encode_image(image_path)
    client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        timeout=GENERATION_TIMEOUT_SECONDS or OPENAI_TIMEOUT_SECONDS,
        max_retries=0,
    )

    def create_completion():
        return client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You analyze enterprise architecture images. "
                        "Explain components, flows, relationships, and intent. "
                        "Write in clear documentation style."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Analyze this image:"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_b64}"
                            },
                        },
                    ],
                },
            ],
            max_tokens=600,
        )

    response = retry_with_backoff(
        create_completion,
        max_attempts=RETRY_MAX_ATTEMPTS,
        base_delay_seconds=RETRY_BASE_DELAY_SECONDS,
        max_delay_seconds=RETRY_MAX_DELAY_SECONDS,
    )

    return response.choices[0].message.content.strip()
