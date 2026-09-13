import { useMemo, useState } from "react";
import { useProfiles, useSelectProfile, type ProfileRecord } from "../api/useProfiles";
import { useWorkflow } from "../api/useWorkflow";

/** Bundled titles namespace themselves with a slash: "Tea portafilter/oolong". */
function split(title: string) {
  const at = title.indexOf("/");
  return at === -1
    ? { group: "Espresso", name: title }
    : { group: title.slice(0, at), name: title.slice(at + 1) };
}

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
      const { group, name } = split(record.profile.title);
      if (needle && !record.profile.title.toLowerCase().includes(needle)) continue;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push({ record, name });
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === "Espresso" ? -1 : b === "Espresso" ? 1 : a.localeCompare(b),
    );
  }, [profiles, query]);

  if (isLoading) return <div className="panel" />;

  return (
    <div className="panel">
      <input
        className="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${profiles?.length ?? 0} profiles`}
        aria-label="Search profiles"
      />

      {groups.length === 0 && (
        <div className="empty">
          <h2 className="empty__h">Nothing matches “{query}”</h2>
          <p className="empty__p">Clear the search to see every installed profile.</p>
        </div>
      )}

      {groups.map(([group, entries]) => (
        <section key={group} style={{ paddingTop: 20 }}>
          <div className="lbl" style={{ paddingBottom: 8 }}>{group}</div>
          <div className="rows">
            {entries.map(({ record, name }) => {
              const on = record.profile.title === current;
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
                  <span className="row__sub num pick__meta">
                    {record.profile.steps?.length ?? 0} steps
                    {record.profile.target_weight ? ` · ${record.profile.target_weight} g` : ""}
                  </span>
                  {on && <span className="lbl pick__on">On</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
