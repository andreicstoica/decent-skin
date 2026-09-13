import { useMemo, useState } from "react";
import { useProfiles, useSelectProfile, type ProfileRecord } from "../api/useProfiles";
import { useWorkflow } from "../api/useWorkflow";
import { ProfileSpark } from "../components/ProfileSpark";
import { factsOf, styleOf, styleRank } from "../api/profileStyle";

/** Bundled titles namespace themselves with a slash: "Tea portafilter/oolong". */
const shortName = (title: string) => title.slice(title.indexOf("/") + 1);

export function ProfilesView() {
  const { data: profiles, isLoading } = useProfiles();
  const { data: workflow } = useWorkflow();
  const select = useSelectProfile();
  const [query, setQuery] = useState("");

  const current = workflow?.profile?.title;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<string, { record: ProfileRecord; name: string }[]>();
    for (const record of profiles ?? []) {
      if (needle && !record.profile.title.toLowerCase().includes(needle)) continue;
      const group = styleOf(record);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push({ record, name: shortName(record.profile.title) });
    }
    return [...map.entries()].sort(([a], [b]) => styleRank(a) - styleRank(b));
  }, [profiles, query]);

  if (isLoading) return <div className="panel" />;

  return (
    <div className="panel">
      <div className="picks__head">
        <input
          className="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${profiles?.length ?? 0} profiles`}
          aria-label="Search profiles"
        />
        <div className="picks__cols">
          <span className="lbl pick__main">Profile</span>
          <span className="lbl pick__n">Peak bar</span>
          <span className="lbl pick__n">Max time</span>
          <span className="lbl pick__n">Out</span>
          <span className="lbl pick__shape">
            <span className="key"><i style={{ background: "hsl(var(--ch-pressure))" }} />pressure</span>
            <span className="key"><i style={{ background: "hsl(var(--ch-flow))" }} />flow</span>
          </span>
          <span className="pick__on" />
        </div>
      </div>

      {groups.length === 0 && (
        <div className="empty">
          <h2 className="empty__h">Nothing matches “{query}”</h2>
          <p className="empty__p">Clear the search to see every installed profile.</p>
        </div>
      )}

      {groups.map(([group, entries]) => (
        <section key={group}>
          <div className="groupbar">
            <span className="lbl">{group}</span>
            <span className="lbl groupbar__n num">{entries.length}</span>
          </div>
          <div className="rows">
            {entries.map(({ record, name }) => {
              const on = record.profile.title === current;
              const facts = factsOf(record);
              return (
                <button
                  key={record.id}
                  className={`pick ${on ? "pick--on" : ""}`}
                  onClick={() => !on && select.mutate(record)}
                  disabled={select.isPending}
                >
                  <span className="pick__main">
                    <span className="row__title">{name}</span>
                    {record.profile.notes && (
                      <span className="row__sub pick__notes">{record.profile.notes}</span>
                    )}
                  </span>
                  <span className="num pick__n">
                    {facts.peakBar === null ? "—" : facts.peakBar.toFixed(1)}
                  </span>
                  <span className="num pick__n">{facts.seconds ? `${facts.seconds}s` : "—"}</span>
                  <span className="num pick__n">
                    {facts.outGrams === null ? "—" : `${facts.outGrams}g`}
                  </span>
                  <span className="pick__shape">
                    <ProfileSpark steps={record.profile.steps ?? []} />
                  </span>
                  <span className="pick__on">{on ? <span className="lbl">On</span> : null}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
