from answerlint_visibility_crew.crew import AnswerEvidenceCrew
from answerlint_visibility_crew.settings import Settings


def test_crew_builds_bounded_roles_and_tasks(tmp_path) -> None:
    settings = Settings(
        signing_secret="s" * 32,
        llm_api_key="test-key",
        storage_dir=str(tmp_path),
    )

    crew = AnswerEvidenceCrew(settings).crew()

    assert len(crew.agents) == 4
    assert len(crew.tasks) == 4
    assert all(agent.allow_delegation is False for agent in crew.agents)
    assert crew.tasks[-1].output_pydantic is not None
    assert crew.tasks[-1].guardrail is not None
