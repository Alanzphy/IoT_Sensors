from datetime import UTC, datetime

from app.jobs.ai_report_scheduler import should_run_now


class TestAIReportScheduler:
    def test_should_run_once_after_scheduled_time(self):
        now = datetime(2026, 4, 26, 2, 5, tzinfo=UTC)
        result = should_run_now(
            enabled=True,
            now=now,
            schedule_hour=2,
            schedule_minute=0,
            last_run_day=None,
        )
        assert result is True

    def test_should_not_run_before_scheduled_time(self):
        now = datetime(2026, 4, 26, 1, 59, tzinfo=UTC)
        result = should_run_now(
            enabled=True,
            now=now,
            schedule_hour=2,
            schedule_minute=0,
            last_run_day=None,
        )
        assert result is False

    def test_should_not_run_twice_same_day(self):
        now = datetime(2026, 4, 26, 3, 0, tzinfo=UTC)
        result = should_run_now(
            enabled=True,
            now=now,
            schedule_hour=2,
            schedule_minute=0,
            last_run_day="2026-04-26",
        )
        assert result is False
