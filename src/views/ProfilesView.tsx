import { useMemo, useState } from "react";
import { useProfiles, type ProfileRecord } from "../api/useProfiles";
import { useWorkflow } from "../api/useWorkflow";
import {
  MAX_FAVORITES,
  useFavorites,
  useSelectProfile,
  useToggleFavorite,
} from "../api/useFavorites";
import { ProfileSpark } from "../components/ProfileSpark";
import { ProfileModal } from "../components/ProfileModal";
import { StarIcon } from "../components/icons";
import { factsOf, shortName, styleOf, styleRank } from "../api/profileStyle";

interface ProfilesViewProps {
  /** Called after a profile is loaded as a 1-off, so the shot can start. */
  onOneOffLoaded: () => void;
}

export function ProfilesView({ onOneOffLoaded }: ProfilesViewProps) {
  const { data: profiles, isLoading } = useProfiles();
  const { data: workflow } = useWorkflow();
  const { favoriteIds, oneOffReturnId } = useFavorites();
  const select = useSelectProfile();
  const toggleFavorite = useToggleFavorite();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const current = workflow?.profile?.title;
  const full = favoriteIds.length >= MAX_FAVORITES;
  const busy = select.isPending;

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

  // A 1-off from inside a 1-off keeps the original way back.
  const returnToId =
    oneOffReturnId ?? profiles?.find((record) => record.profile.title === current)?.id ?? null;

  const open = profiles?.find((record) => record.id === openId);
  const close = () => setOpenId(null);

  const loadOneOff = (record: ProfileRecord) =>
    select.mutate(
      { record, returnToId },
      {
        onSuccess: () => {
          close();
          onOneOffLoaded();
        },
      },
    );

  const loadForGood = (record: ProfileRecord) =>
    select.mutate({ record }, { onSuccess: close });

  if (isLoading) return <div className="panel" />;

  return (
    <div className="panel picks">
      <div className="picks__head">
        <div className="picks__top">
          <input
            className="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${profiles?.length ?? 0} profiles`}
            aria-label="Search profiles"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          <span className="lbl picks__count">
            <span className="num">
              {favoriteIds.length}/{MAX_FAVORITES}
            </span>{" "}
            pinned
          </span>
        </div>
        <div className="picks__cols">
          <span className="lbl">Profile</span>
          <span className="lbl pick__n">Peak bar</span>
          <span className="lbl pick__n">Max time</span>
          <span className="lbl pick__n">Out</span>
          <span className="lbl pick__shape">
            <span className="key"><i className="key__sw key__sw--pressure" />pressure</span>
            <span className="key"><i className="key__sw key__sw--flow" />flow</span>
          </span>
          <span />
        </div>
      </div>

      {groups.length === 0 && (
        <div className="empty empty--inline">
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
              const pinned = favoriteIds.includes(record.id);
              const pinning = toggleFavorite.isPending && toggleFavorite.variables === record.id;
              const facts = factsOf(record);
              return (
                <div key={record.id} className={`pick ${on ? "pick--on" : ""}`}>
                  {/* The button's ::after covers the row; the star sits above it. */}
                  <button
                    type="button"
                    className="pick__hit"
                    aria-current={on ? "true" : undefined}
                    aria-haspopup="dialog"
                    onClick={() => setOpenId(record.id)}
                  >
                    <span className="row__title truncate">{name}</span>
                    {record.profile.notes && (
                      <span className="row__sub pick__notes truncate">{record.profile.notes}</span>
                    )}
                  </button>
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
                  <span className="pick__acts">
                    {on && <span className="tag tag--on">On</span>}
                    <button
                      type="button"
                      className={`pin ${pinned ? "pin--on" : ""}`}
                      aria-pressed={pinned}
                      aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
                      title={!pinned && full ? `${MAX_FAVORITES} favorites pinned. Unpin one first.` : undefined}
                      onClick={() => toggleFavorite.mutate(record.id)}
                      disabled={pinning || (!pinned && full)}
                    >
                      <StarIcon filled={pinned} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {open && (
        <ProfileModal
          record={open}
          loaded={open.profile.title === current}
          pinned={favoriteIds.includes(open.id)}
          pinnedCount={favoriteIds.length}
          busy={busy}
          loadFailed={select.isError && select.variables?.record.id === open.id}
          pinning={toggleFavorite.isPending && toggleFavorite.variables === open.id}
          onClose={close}
          onOneOff={() => loadOneOff(open)}
          onLoad={() => loadForGood(open)}
          onTogglePin={() => toggleFavorite.mutate(open.id)}
        />
      )}
    </div>
  );
}
