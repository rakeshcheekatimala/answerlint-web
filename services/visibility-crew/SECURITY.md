# Crew service security boundary

This service exposes only `/health` and the HMAC-authenticated `/v1/analyze`
endpoint. It does not expose a ChromaDB server, CrewAI memory/RAG, agent tools,
code execution, or delegation. Deploy it behind private ingress and run only
the documented Uvicorn command.

CrewAI 1.15.18 imports ChromaDB even when memory is disabled. ChromaDB 1.5.9 is
the newest available version but has four advisories affecting its HTTP server,
tenant authorization, and remote model-loading paths. Those paths are not
reachable in this process. Until CrewAI removes the mandatory import or Chroma
publishes a fixed release, do not add Chroma endpoints, memory, knowledge
sources, embedding providers, or user-selected model repositories here.
