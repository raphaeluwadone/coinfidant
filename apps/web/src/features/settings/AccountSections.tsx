import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { deleteAccount, downloadExport } from "../../lib/account";
import { meQuery } from "../../lib/auth";
import { currentSubscription, disablePush, enablePush, pushSupported, sendTestPush } from "../../lib/push";

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches;

/** This device's push switch for the evening check-in. */
export function Notifications() {
  const qc = useQueryClient();
  const { data: sub, isPending } = useQuery({ queryKey: ["push", "sub"], queryFn: currentSubscription });
  const [note, setNote] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: async (on: boolean) => (on ? enablePush() : disablePush().then(() => "off" as const)),
    onSuccess: (r) => {
      setNote(
        r === "denied"
          ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
          : r === "unavailable"
            ? "Notifications aren't set up on the server yet."
            : null,
      );
      qc.invalidateQueries({ queryKey: ["push", "sub"] });
    },
    onError: () => setNote("Couldn't change notifications. Try again?"),
  });
  const test = useMutation({ mutationFn: sendTestPush });

  if (!pushSupported())
    return (
      <p className="settings__hint">
        {/iPhone|iPad/.test(navigator.userAgent) && !standalone()
          ? "On iPhone, add Coinfidant to your Home Screen first (Share, then Add to Home Screen) to get check-ins."
          : "This browser can't show notifications."}
      </p>
    );

  return (
    <>
      <label className="card settings__row">
        <span>
          🔔 Notifications on this device
          <small>Your check-in arrives around 8pm</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={!!sub}
          disabled={isPending || toggle.isPending}
          onChange={(e) => toggle.mutate(e.target.checked)}
        />
      </label>
      {sub && (
        <button className="link-btn" disabled={test.isPending} onClick={() => test.mutate()}>
          {test.isSuccess ? "Sent. Check your notifications 🔔" : "Send a test notification"}
        </button>
      )}
      {note && (
        <p className="settings__error" role="alert">
          {note}
        </p>
      )}
    </>
  );
}

export function YourData() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const inputId = useId();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const exp = useMutation({ mutationFn: downloadExport });
  const del = useMutation({
    mutationFn: async () => {
      await disablePush().catch(() => {});
      await deleteAccount();
    },
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(meQuery.queryKey, null);
      navigate({ to: "/login" });
    },
  });

  return (
    <section>
      <h2>Your data</h2>
      <button className="card settings__row settings__link" disabled={exp.isPending} onClick={() => exp.mutate()}>
        <span>
          📦 Download my data
          <small>Everything you've entered, as a JSON file</small>
        </span>
        <span className="settings__change">{exp.isPending ? "…" : "›"}</span>
      </button>
      {exp.isError && (
        <p className="settings__error" role="alert">
          The download didn't start. Try again?
        </p>
      )}

      {!confirming ? (
        <button className="link-btn settings__danger" onClick={() => setConfirming(true)}>
          Delete my account
        </button>
      ) : (
        <div className="card settings__confirm">
          <p>
            This deletes your account, budget, history and coach reads right now. It can't be undone. Download your data
            first if you want a copy.
          </p>
          <label htmlFor={inputId}>Type DELETE to confirm</label>
          <input
            id={inputId}
            className="settings__input"
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="settings__confirm-actions">
            <button
              className="btn btn--danger"
              disabled={typed !== "DELETE" || del.isPending}
              onClick={() => del.mutate()}
            >
              Delete everything
            </button>
            <button
              className="link-btn"
              onClick={() => {
                setConfirming(false);
                setTyped("");
              }}
            >
              Keep my account
            </button>
          </div>
          {del.isError && (
            <p className="settings__error" role="alert">
              That didn't go through. Nothing was deleted.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
