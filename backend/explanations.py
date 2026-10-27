"""Optional text-only guidance. A language model does not inspect image pixels."""
import logging
import os

logger = logging.getLogger(__name__)


def build_explainer():
    if os.getenv("ENABLE_WATSONX", "0") != "1":
        return None
    try:
        from ibm_watsonx_ai import Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference
        workspace = {}
        if os.getenv("IBM_SPACE_ID"):
            workspace["space_id"] = os.environ["IBM_SPACE_ID"]
        else:
            workspace["project_id"] = os.environ["IBM_PROJECT_ID"]
        client = ModelInference(
            model_id=os.environ["IBM_MODEL_ID"],
            credentials=Credentials(
                url=f"https://{os.environ['IBM_REGION']}.ml.cloud.ibm.com",
                api_key=os.environ["IBM_API_KEY"],
            ),
            params={"decoding_method": "greedy", "max_new_tokens": 100},
            **workspace,
        )
        return lambda prompt: client.generate_text(prompt=prompt)
    except Exception:
        logger.warning("Optional Watsonx guidance unavailable; using local guidance.")
        return None


def explain_prediction(label, confidence, generator=None):
    guidance = (
        f"The image classifier leans toward '{label}' with a model score of {confidence}%. "
        "This score is not proof of authenticity or manipulation. "
        "Check the original source and context before sharing."
    )
    if generator:
        try:
            text = generator(
                f"An image classifier returned label {label} and score {confidence}%. "
                "You have not seen the image. In two sentences explain that this is an "
                "uncertain model prediction and suggest checking the original source. "
                "Do not describe visual features or claim evidence of manipulation."
            )
            if isinstance(text, str) and text.strip():
                return guidance + " Additional general guidance: " + text.strip()[:1000]
        except Exception:
            logger.warning("Optional Watsonx request failed; using local guidance.")
    return guidance
