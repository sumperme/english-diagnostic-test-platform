// Paper I report sections (Oct 2026 sample report). Every comment comes from the
// feedback rows in the report payload; labels come from REPORT_MESSAGES.

import type { ReactNode } from 'react';
import { REPORT_MESSAGES } from '../i18n/reportMessages';
import {
  PAPER1_TEMPLATE_CODES,
  concludingFields,
  fillTemplate,
  formatLongDate,
  formatPaper1Level,
  formatReportPercent,
  grammarFields,
  paper1GrammarPoints,
  roadmapBullets,
} from '../lib/paper1Report';
import type { FeedbackItem, Paper1Area, Paper1Report, ReportVariables } from '../types';
import { MasteryBar } from './MasteryBar';
import { RadarChart } from './RadarChart';
import { RichText } from './RichText';

const r = REPORT_MESSAGES;
const p = REPORT_MESSAGES.paper1;

type Feedback = Record<string, FeedbackItem>;

const areaName = (key: string) => r.dimensionLabels[key as keyof typeof r.dimensionLabels] ?? key;
const areaShort = (key: string) => r.dimensionShorts[key as keyof typeof r.dimensionShorts] ?? key;
const areaLabel = (area: Paper1Area) => r.levelLabels[area.labelKey] ?? area.labelKey;
const areaTitle = (area: Paper1Area) => `${p.area} ${Number(area.dimensionCode)}: ${areaName(area.key)}`;
const bodyOf = (feedback: Feedback, code: string) => feedback[code]?.body ?? '';

function orderedAreas(report: Paper1Report, keys: string[]): Paper1Area[] {
  const byKey = new Map(report.partA.areas.map((area) => [area.key, area]));
  return keys.map((key) => byKey.get(key)).filter((area): area is Paper1Area => !!area);
}

/** Forest band with a neon accent, matching the PDF part headings. */
export function ReportBand({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center border-l-4 border-edt-neon bg-edt-forest px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-edt-neon">
      {children}
    </h2>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 print:break-inside-avoid ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 border-b border-edt-gold/40 pb-2 text-sm font-semibold uppercase tracking-[0.18em] text-edt-forest">
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="break-words text-sm leading-relaxed text-slate-700">{children}</p>;
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-edt-olive">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-edt-forest">{value}</p>
      {sub ? <p className="text-sm text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function Paper1Summary({ variables, report }: { variables: ReportVariables; report: Paper1Report }) {
  const { overall } = report;
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Fact label={p.candidateName} value={variables.candidate.name || '—'} sub={variables.candidate.ref} />
        <Fact label={p.date} value={formatLongDate(variables.attempt.endTime || variables.attempt.startTime)} />
      </div>
      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-edt-forest p-4 text-edt-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-edt-neon">{p.overallScore}</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {overall.correct} / {overall.total}
          </p>
          <p className="text-sm text-edt-soft/80">{formatReportPercent(overall.percent)}%</p>
        </div>
        <div className="rounded-xl border border-edt-gold/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-edt-olive">{p.cefrLevel}</p>
          <p className="mt-1 text-2xl font-semibold text-edt-forest">{overall.band.cefrLabel}</p>
          <p className="text-sm text-slate-500">{overall.band.levelLabel}</p>
        </div>
        <div className="rounded-xl border border-edt-gold/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-edt-olive">{p.estimatedIelts}</p>
          <p className="mt-1 text-2xl font-semibold text-edt-forest">{overall.band.ielts ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-edt-gold/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-edt-olive">{p.estimatedToefl}</p>
          <p className="mt-1 text-2xl font-semibold text-edt-forest">{overall.band.toefl ?? '—'}</p>
        </div>
      </div>
      <p className="mt-4 text-xs italic leading-relaxed text-slate-500">{r.proficiencyDisclaimer}</p>
    </Card>
  );
}

function Placement({ label, level, scoreLabel, score }: { label: string; level: string; scoreLabel: string; score: string }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
      <dt className="font-semibold text-edt-olive">{label}</dt>
      <dd className="font-semibold text-edt-forest">
        {p.cefrLevelPrefix} {level}
      </dd>
      <dt className="font-semibold text-edt-olive">{scoreLabel}</dt>
      <dd className="font-semibold text-edt-forest">{score}</dd>
    </dl>
  );
}

function AreaRow({ area }: { area: Paper1Area }) {
  const label = areaLabel(area);
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center sm:gap-4">
      <p className="min-w-0 break-words text-sm text-slate-700">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-edt-olive">
          {p.area} {area.dimensionCode}
        </span>
        {areaName(area.key)}
      </p>
      <MasteryBar percent={area.max > 0 ? (area.score / area.max) * 100 : 0} segments={area.max || 5} label={`${area.score}/${area.max} ${label}`} />
      <div className="flex items-center gap-2 sm:w-[13rem] sm:justify-end">
        <span className="text-sm font-semibold text-edt-forest">
          {area.score}/{area.max}
        </span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${area.priority ? 'text-edt-gold' : 'text-edt-forest'}`}>
          {label}
        </span>
        {area.priority ? (
          <span className="rounded-full border border-edt-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-edt-gold">
            {p.priority}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function Paper1MasteryProfile({ report }: { report: Paper1Report }) {
  const { partA } = report;
  return (
    <Card>
      <CardTitle>{p.masteryProfile}</CardTitle>
      <Placement
        label={p.partAPlacement}
        level={formatPaper1Level(partA.band)}
        scoreLabel={p.partAScore}
        score={`${partA.correct} / ${partA.total}`}
      />
      <div className="report-radar-export mx-auto mt-4 w-full max-w-xl overflow-visible">
        <RadarChart
          axes={partA.areas.map((area) => ({ id: area.key, short: areaShort(area.key), score: area.score, max: area.max }))}
        />
      </div>
      <ul className="divide-y divide-slate-100">
        {partA.areas.map((area) => (
          <AreaRow key={area.key} area={area} />
        ))}
      </ul>
    </Card>
  );
}

export function Paper1Strengths({ report, feedback }: { report: Paper1Report; feedback: Feedback }) {
  const strengths = orderedAreas(report, report.partA.strengthKeys);
  return (
    <Card>
      <CardTitle>{p.strengthsTitle}</CardTitle>
      {strengths.length === 0 ? (
        <Paragraph>{r.none}</Paragraph>
      ) : (
        <div className="space-y-4">
          <Paragraph>
            <RichText text={fillTemplate(bodyOf(feedback, PAPER1_TEMPLATE_CODES.strengthsIntro), { n: strengths.length })} />
          </Paragraph>
          <div className="grid gap-4 lg:grid-cols-2">
            {strengths.map((area) => (
              <article
                key={area.key}
                className="rounded-xl border border-edt-gold/30 border-l-4 border-l-edt-neon bg-slate-50 p-4 print:break-inside-avoid"
              >
                <h4 className="break-words text-sm font-semibold text-edt-forest">{areaTitle(area)}</h4>
                <p className="mt-0.5 text-xs font-semibold text-edt-gold">
                  ({area.score}/{area.max} - {areaLabel(area)})
                </p>
                <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">
                  <RichText text={bodyOf(feedback, area.overviewCode)} />
                </p>
              </article>
            ))}
          </div>
          <Paragraph>
            <RichText text={bodyOf(feedback, PAPER1_TEMPLATE_CODES.strengthsClosing)} />
          </Paragraph>
        </div>
      )}
    </Card>
  );
}

function GrammarPointCard({ item }: { item: FeedbackItem }) {
  return (
    <article className="overflow-hidden rounded-xl border border-edt-gold/40 print:break-inside-avoid">
      <header className="bg-edt-forest px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-edt-neon">{p.grammarPoint}</p>
        <h5 className="mt-0.5 break-words text-sm font-semibold text-edt-soft">
          <RichText text={item.heading ?? ''} />
        </h5>
      </header>
      <dl className="divide-y divide-slate-100 px-4">
        {grammarFields(item).map((field, index) => (
          <div key={`${field.label}-${index}`} className="grid gap-1 py-2.5 sm:grid-cols-[8rem_1fr] sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-edt-olive">{field.label}</dt>
            <dd className="break-words text-sm leading-relaxed text-slate-700">
              <RichText text={field.text} />
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function Paper1GrowthRoadmap({ report, feedback }: { report: Paper1Report; feedback: Feedback }) {
  const growth = orderedAreas(report, report.partA.growthKeys);
  return (
    <Card>
      <CardTitle>{p.roadmapTitle}</CardTitle>
      {growth.length === 0 ? (
        <Paragraph>{r.none}</Paragraph>
      ) : (
        <div className="space-y-8">
          <Paragraph>
            <RichText text={fillTemplate(bodyOf(feedback, PAPER1_TEMPLATE_CODES.roadmapIntro), { n: growth.length })} />
          </Paragraph>
          {growth.map((area) => (
            <div key={area.key} className="space-y-3">
              <div>
                <h4 className="break-words text-base font-semibold text-edt-forest">{areaTitle(area)}</h4>
                <p className="text-sm font-semibold text-edt-gold">
                  {p.scoreLabel}: {area.score}/{area.max} - {areaLabel(area)}
                </p>
              </div>
              <Paragraph>
                <span className="font-semibold text-edt-forest">{p.areaOverview}: </span>
                <RichText text={bodyOf(feedback, area.overviewCode)} />
              </Paragraph>
              <div className="space-y-3">
                {paper1GrammarPoints(area, feedback).map((item) => (
                  <GrammarPointCard key={item.code} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function Paper1Concluding({ report, feedback }: { report: Paper1Report; feedback: Feedback }) {
  const item = feedback[report.partA.concludingCode];
  if (!item) return null;
  const fields = concludingFields(item);
  return (
    <Card>
      <CardTitle>{p.concludingTitle}</CardTitle>
      {fields ? (
        <div className="space-y-3">
          {fields.intro ? (
            <Paragraph>
              <RichText text={fields.intro} />
            </Paragraph>
          ) : null}
          {fields.steps?.length ? (
            <ul className="space-y-2 pl-1">
              {fields.steps.map((step) => (
                <li key={step.label} className="break-words text-sm leading-relaxed text-slate-700">
                  <span className="font-semibold text-edt-forest">{step.label}: </span>
                  <RichText text={step.text} />
                </li>
              ))}
            </ul>
          ) : null}
          {fields.closing ? (
            <Paragraph>
              <RichText text={fields.closing} />
            </Paragraph>
          ) : null}
        </div>
      ) : (
        <Paragraph>
          <RichText text={item.body} />
        </Paragraph>
      )}
    </Card>
  );
}

export function Paper1Vocabulary({ report, feedback }: { report: Paper1Report; feedback: Feedback }) {
  const { partB } = report;
  const additional = partB.additional
    ? fillTemplate(bodyOf(feedback, partB.additional.code), { level: partB.additional.level })
    : '';
  const roadmap = feedback[partB.roadmapCode];
  return (
    <Card>
      <Placement
        label={p.partBPlacement}
        level={formatPaper1Level(partB.band)}
        scoreLabel={p.partBScore}
        score={`${partB.correct} / ${partB.total}`}
      />

      <h4 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-edt-olive">{p.cefrBreakdown}</h4>
      <ul className="space-y-3">
        {partB.levels.map((level) => (
          <li key={level.level} className="grid gap-1.5 sm:grid-cols-[16rem_1fr_3.5rem] sm:items-center sm:gap-4">
            <span className="text-sm font-semibold text-slate-700">{p.levelTitles[level.level]}</span>
            <MasteryBar percent={level.percent} segments={10} label={`${formatReportPercent(level.percent)}%`} />
            <span className="text-sm font-semibold text-edt-forest sm:text-right">{formatReportPercent(level.percent)}%</span>
          </li>
        ))}
      </ul>

      <h4 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-edt-olive">{p.overallComments}</h4>
      <Paragraph>
        <RichText text={[bodyOf(feedback, partB.placementCode), additional].filter(Boolean).join(' ')} />
      </Paragraph>

      {roadmap ? (
        <>
          <h4 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-edt-olive">{p.partBRoadmap}</h4>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-edt-gold">
            {roadmapBullets(roadmap).map((bullet) => (
              <li key={bullet} className="break-words text-sm leading-relaxed text-slate-700">
                <RichText text={bullet} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
