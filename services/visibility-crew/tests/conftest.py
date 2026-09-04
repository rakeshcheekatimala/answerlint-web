import os


os.environ.setdefault("ANSWERLINT_CREW_SIGNING_SECRET", "s" * 32)
os.environ.setdefault("ANSWERLINT_CREW_LLM_API_KEY", "test-key")
os.environ.setdefault("ANSWERLINT_CREW_ALLOWED_HOSTS", "testserver,localhost,127.0.0.1")
