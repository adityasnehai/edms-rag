import base64
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _encode_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_text_from_image(image_path: str) -> str:
    """
    Vision-LLM reasoning over diagrams, screenshots, architecture images.
    """

    image_b64 = _encode_image(image_path)

    response = client.chat.completions.create(
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

    return response.choices[0].message.content.strip()
