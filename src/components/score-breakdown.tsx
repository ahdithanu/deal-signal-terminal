import type { Opportunity } from "@/types/domain";

export function ScoreBreakdown({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Scoring engine</p>
          <h3 className="section-title">Transparent priority model</h3>
        </div>
        <div className="section-score">{opportunity.priorityScore} / 100</div>
      </div>

      <div className="score-breakdown">
        {opportunity.scoreBreakdown.map((dimension) => (
          <div className="score-row" key={dimension.key}>
            <div className="row-top">
              <div>
                <strong>{dimension.label}</strong>
                <p>{dimension.reason}</p>
              </div>
              <span className="row-score">
                {dimension.score} / {dimension.maxScore}
              </span>
            </div>
            <div className="progress progress-small">
              <div
                className="progress-bar"
                style={{ width: `${(dimension.score / dimension.maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
