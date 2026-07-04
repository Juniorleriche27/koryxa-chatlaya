from __future__ import annotations

import hashlib
import json
import logging
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Sequence

from app.core.config import settings


SYSTEM_PROMPT = (
    "Tu es CHATLAYA, copilote IA de KORYXA. Reponds en francais clair, "
    "en tenant compte du contexte utilisateur et en restant factuel."
)

logger = logging.getLogger(__name__)
FALLBACK_REPLY = "Je rencontre un probleme technique pour le moment. Merci de reessayer plus tard."


def _hash_to_float32(seed: bytes) -> float:
    h = int.from_bytes(seed[:8], byteorder="big", signed=False)
    return (h % 2_000_000) / 1_000_000.0 - 1.0


_cohere_client = None


def _get_cohere_client():
    global _cohere_client
    if _cohere_client is None:
        try:
            import cohere  # type: ignore

            if not settings.COHERE_API_KEY:
                raise RuntimeError("Missing COHERE_API_KEY")
            _cohere_client = cohere.Client(api_key=settings.COHERE_API_KEY)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Cohere client init failed: %s", exc)
            _cohere_client = False
    return _cohere_client


def embed_texts(texts: Sequence[str], dim: int | None = None, input_type: str = "search_query") -> List[List[float]]:
    client = None

    # ChatLAYA peut utiliser Ollama/Gemma pour répondre,
    # mais les embeddings RAG doivent utiliser Cohere si la clé est disponible.
    # Sinon, on tombe sur le fallback déterministe local.
    if settings.COHERE_API_KEY:
        client = _get_cohere_client()
    if client:
        try:
            model = settings.EMBED_MODEL or "embed-multilingual-v3.0"
            resp = client.embed(texts=list(texts), model=model, input_type=input_type)
            return [list(map(float, vector)) for vector in resp.embeddings]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Cohere embed failed, falling back to stub: %s", exc)
    dimension = dim or settings.EMBED_DIM
    vectors: List[List[float]] = []
    for text in texts:
        base = hashlib.sha256(text.encode("utf-8")).digest()
        vector: List[float] = []
        chunk = base
        i = 0
        while len(vector) < dimension:
            if i % len(base) == 0:
                chunk = hashlib.sha256(chunk).digest()
            vector.append(_hash_to_float32(chunk[i % len(chunk):] + i.to_bytes(2, "big")))
            i += 1
        vectors.append(vector)
    return vectors



def _build_ollama_prompt(
    effective_prompt: str,
    history: Optional[List[dict[str, str]]] = None,
    context: str | None = None,
) -> str:
    parts: List[str] = [SYSTEM_PROMPT]

    if context:
        parts.append(
            "Contexte disponible. Utilise-le seulement s'il est pertinent. "
            "Si le contexte ne suffit pas, dis clairement que l'information manque.\n\n"
            f"{context.strip()}"
        )

    if history:
        compact_history: List[str] = []
        for msg in history[-6:]:
            role = (msg.get("role") or "").strip().lower()
            content = (msg.get("content") or "").strip()
            if not content:
                continue
            if role == "assistant":
                compact_history.append(f"Assistant: {content}")
            elif role == "user":
                compact_history.append(f"Utilisateur: {content}")
        if compact_history:
            parts.append("Historique récent:\n" + "\n".join(compact_history))

    parts.append("Demande utilisateur:\n" + effective_prompt.strip())

    user_content = "\n\n".join(part for part in parts if part.strip())
    return f"<start_of_turn>user\n{user_content}<end_of_turn>\n<start_of_turn>model\n"


def _call_ollama_generate(
    prompt: str,
    model: str,
    timeout: int,
    max_new_tokens: int | None = None,
    on_token: Optional[Callable[[str], None]] = None,
) -> str:
    base_url = (settings.OLLAMA_BASE_URL or "http://127.0.0.1:11434").rstrip("/")
    url = f"{base_url}/api/generate"

    payload = {
        "model": model,
        "raw": True,
        "prompt": prompt,
        "stream": bool(on_token),
        "options": {
            "temperature": 0.4,
            "top_p": 0.9,
            "num_predict": max_new_tokens or settings.LLM_MAX_NEW_TOKENS,
        },
    }

    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        if on_token:
            chunks: list[str] = []
            for raw_line in response:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                parsed = json.loads(line)
                token = str(parsed.get("response") or "")
                if token:
                    chunks.append(token)
                    on_token(token)
                if parsed.get("done"):
                    break
            text = "".join(chunks).strip()
            if not text:
                raise RuntimeError("Ollama returned an empty streamed response")
            return text

        body = response.read().decode("utf-8")

    parsed = json.loads(body)
    text = (parsed.get("response") or "").strip()
    if not text:
        raise RuntimeError(f"Ollama returned an empty response: {body[:500]}")
    return text

def _call_ai_gateway_chat(
    prompt: str,
    timeout: int | None = None,
    max_new_tokens: int | None = None,
    on_token: Optional[Callable[[str], None]] = None,
) -> str:
    base_url = (settings.AI_GATEWAY_BASE_URL or "").rstrip("/")
    api_key = settings.AI_GATEWAY_API_KEY

    if not base_url:
        raise RuntimeError("AI_GATEWAY_BASE_URL is not configured")
    if not api_key:
        raise RuntimeError("AI_GATEWAY_API_KEY is not configured")

    payload = {
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "temperature": 0.4,
        "max_tokens": max_new_tokens or settings.LLM_MAX_NEW_TOKENS,
        "stream": bool(on_token),
    }

    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url}/v1/chat",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "X-API-Key": api_key,
        },
    )

    def _extract_stream_token(parsed: dict[str, Any]) -> str:
        if isinstance(parsed.get("choices"), list) and parsed["choices"]:
            choice = parsed["choices"][0]
            if isinstance(choice, dict):
                delta = choice.get("delta") or {}
                message = choice.get("message") or {}
                return str(delta.get("content") or message.get("content") or choice.get("text") or "")
        return str(
            parsed.get("token")
            or parsed.get("content")
            or parsed.get("text")
            or parsed.get("response")
            or ""
        )

    try:
        with urllib.request.urlopen(
            req,
            timeout=timeout or settings.AI_GATEWAY_TIMEOUT_SECONDS,
        ) as resp:
            if on_token:
                chunks: list[str] = []
                for raw_line in resp:
                    line = raw_line.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if line == "[DONE]":
                        break
                    try:
                        parsed_line = json.loads(line)
                    except json.JSONDecodeError:
                        token = line
                    else:
                        token = _extract_stream_token(parsed_line)
                    if token:
                        chunks.append(token)
                        on_token(token)
                streamed_text = "".join(chunks).strip()
                if streamed_text:
                    return streamed_text

            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        if on_token:
            logger.warning("AI gateway streaming failed with HTTP %s, retrying without stream", exc.code)
            return _call_ai_gateway_chat(
                prompt=prompt,
                timeout=timeout,
                max_new_tokens=max_new_tokens,
                on_token=None,
            )
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"AI gateway HTTP {exc.code}: {body[:500]}") from exc

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return raw.strip()

    response = (
        parsed.get("response")
        or parsed.get("text")
        or parsed.get("content")
        or ""
    )

    if not response and isinstance(parsed.get("choices"), list) and parsed["choices"]:
        choice = parsed["choices"][0]
        if isinstance(choice, dict):
            message = choice.get("message") or {}
            response = message.get("content") or choice.get("text") or ""

    return str(response).strip()


def generate_answer(
    prompt: str,
    provider: str | None = None,
    model: str | None = None,
    timeout: int | None = None,
    max_new_tokens: int | None = None,
    history: Optional[List[dict[str, str]]] = None,
    context: str | None = None,
    rag_sources: Optional[List[Dict[str, Any]]] = None,
    on_token: Optional[Callable[[str], None]] = None,
) -> str:
    _ = (max_new_tokens, context, rag_sources)
    provider_name = (provider or settings.CHAT_PROVIDER or settings.LLM_PROVIDER or "echo").lower()
    effective_prompt = prompt or (history[-1]["content"] if history else "")
    logger.debug(
        "generate_answer provider=%s history=%d snippet=%r",
        provider_name,
        len(history or []),
        effective_prompt[:80],
    )

    if provider_name in {"local", "smollm", "chatlaya"}:
        provider_name = "cohere" if settings.COHERE_API_KEY else "echo"


    if provider_name in {"ai_gateway", "gateway", "koryxa_gateway"}:
        return _call_ai_gateway_chat(
            prompt=prompt,
            timeout=timeout or settings.AI_GATEWAY_TIMEOUT_SECONDS,
            max_new_tokens=max_new_tokens,
            on_token=on_token,
        )

    if provider_name == "ollama":
        try:
            mdl = model or settings.CHAT_MODEL or settings.LLM_MODEL or "chatlaya-gemma4-e4b"
            last_user = effective_prompt
            if history:
                last_user = next(
                    (msg["content"] for msg in reversed(history) if msg.get("role") == "user"),
                    effective_prompt,
                )
            ollama_prompt = _build_ollama_prompt(last_user, history=history, context=context)
            text = _call_ollama_generate(
                prompt=ollama_prompt,
                model=mdl,
                timeout=timeout or settings.LLM_TIMEOUT,
                max_new_tokens=max_new_tokens,
                on_token=on_token,
            )
            if text and on_token and provider_name != "ollama":
                on_token(text)
            return text
        except Exception as exc:  # noqa: BLE001
            logger.warning("Ollama chat failed, returning explicit error: %s", exc)
            raise RuntimeError(f"Ollama failed: {exc}") from exc

    if provider_name == "cohere":
        client = _get_cohere_client()
        if client:
            try:
                mdl = model or settings.CHAT_MODEL or settings.LLM_MODEL or "command-r-08-2024"
                last_user = effective_prompt
                if history:
                    last_user = next(
                        (msg["content"] for msg in reversed(history) if msg.get("role") == "user"),
                        effective_prompt,
                    )
                resp = client.chat(
                    model=mdl,
                    message=last_user,
                    preamble=SYSTEM_PROMPT,
                )
                text = getattr(resp, "text", None) or str(resp)
                if text and on_token:
                    on_token(text)
                return text
            except Exception as exc:  # noqa: BLE001
                logger.warning("Cohere chat failed, returning explicit error: %s", exc)
                raise RuntimeError(f"Cohere failed: {exc}") from exc

    if provider_name == "echo":
        if on_token:
            on_token(effective_prompt)
        return effective_prompt

    if provider_name in {"openai", "mistral"}:
        logger.warning("Provider '%s' not configured. Falling back to echo.", provider_name)
        if on_token:
            on_token(effective_prompt)
        return effective_prompt

    logger.debug("Returning fallback reply for provider=%s timeout=%s", provider_name, timeout or settings.LLM_TIMEOUT)
    if on_token:
        on_token(FALLBACK_REPLY)
    return FALLBACK_REPLY


def detect_embed_dim() -> int:
    try:
        vector = embed_texts(["dimension_probe"], dim=None)[0]
        return len(vector)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to detect embed dim automatically: %s", exc)
        return settings.EMBED_DIM
