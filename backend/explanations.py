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
            **workspace,
        )
        def generate(prompt):
            response = client.chat(
                messages=[{'role': 'user', 'content': prompt}],
                params={'max_tokens': 200, 'temperature': 0.2},
            )
            return response['choices'][0]['message']['content']
        return generate
    except Exception:
        logger.warning("Optional Watsonx guidance unavailable; using local guidance.")
        return None


def explain_prediction(label, confidence, generator=None, evidence=None):
    guidance = (
        f"The image classifier leans toward '{label}' with a model score of {confidence}%. "
        + (evidence.get('summary', '') + ' ' if evidence else '') +
        "This score is not proof of authenticity or manipulation. "
        "Check the original source and context before sharing."
    )
    if generator:
        try:
            evidence_text = evidence.get('summary', '') if evidence else ''
            text = generator(
                f"An image classifier returned label {label} and score {confidence}%. "
                f"Local Grad-CAM evidence: {evidence_text or 'unavailable'}. "
                "You have not seen the image. Explain in plain language why this classifier "
                "could lean toward the predicted class, using only the supplied attention evidence. "
                "Attention locates influential regions, not confirmed edits. "
                "Do not invent visual defects, describe the score as a calibrated probability, "
                "or assert that a person or image is fraudulent. Give a concrete verification step."
            )
            if isinstance(text, str) and text.strip():
                return guidance + " Additional general guidance: " + text.strip()[:1000]
        except Exception:
            logger.warning("Optional Watsonx request failed; using local guidance.")
    return guidance
