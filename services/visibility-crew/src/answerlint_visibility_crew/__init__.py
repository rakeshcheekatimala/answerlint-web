"""AnswerLint's bounded CrewAI interpretation service."""

import os
from pathlib import Path

# CrewAI resolves some storage paths while its modules are imported. Establish
# a serverless-safe default before importing CrewAI; Settings may narrow the
# directory for a deployment when the crew is constructed.
_default_storage = "/tmp/answerlint-crewai"
Path(_default_storage).mkdir(parents=True, exist_ok=True)
os.environ.setdefault("CREWAI_STORAGE_DIR", _default_storage)

__version__ = "0.1.0"
