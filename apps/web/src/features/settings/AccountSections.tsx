import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { deleteAccount, downloadExport } from "@/lib/account";
import { meQuery } from "@/lib/auth";
import { currentSubscription, disablePush, enablePush, pushSupported, sendTestPush } from "@/lib/push";
import { ErrorNote, Row, RowButton, Section } from "./parts";

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
      <p className="m-0 text-[13px] font-semibold text-muted-foreground">
        {/iPhone|iPad/.test(navigator.userAgent) && !standalone()
          ? "On iPhone, add Coinfidant to your Home Screen first (Share, then Add to Home Screen) to get check-ins."
          : "This browser can't show notifications."}
      </p>
    );

  return (
    <>
      <Row title="🔔 Notifications on this device" hint="Your check-in arrives around 8pm">
        <Switch
          checked={!!sub}
          disabled={isPending || toggle.isPending}
          onCheckedChange={(on) => toggle.mutate(on)}
          aria-label="Notifications on this device"
        />
      </Row>
      {sub && (
        <Button
          variant="link"
          size="inline"
          className="justify-self-start"
          disabled={test.isPending}
          onClick={() => test.mutate()}
        >
          {test.isSuccess ? "Sent. Check your notifications 🔔" : "Send a test notification"}
        </Button>
      )}
      {note && <ErrorNote>{note}</ErrorNote>}
    </>
  );
}

export function YourData() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const inputId = useId();
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
    <Section title="Your data">
      <RowButton
        title="📦 Download my data"
        hint="Everything you've entered, as a JSON file"
        disabled={exp.isPending}
        onClick={() => exp.mutate()}
      >
        <span className="text-[13px] font-semibold text-accent-foreground">{exp.isPending ? "…" : "›"}</span>
      </RowButton>
      {exp.isError && <ErrorNote>The download didn't start. Try again?</ErrorNote>}

      <AlertDialog onOpenChange={(open) => !open && setTyped("")}>
        <AlertDialogTrigger asChild>
          <Button variant="link" size="inline" className="mt-1 justify-self-start text-destructive">
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes your account, budget, history and coach reads right now. It can't be undone. Download your data
            first if you want a copy.
          </AlertDialogDescription>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>Type DELETE to confirm</Label>
            <Input id={inputId} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          </div>
          {del.isError && <ErrorNote>That didn't go through. Nothing was deleted.</ErrorNote>}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              disabled={typed !== "DELETE" || del.isPending}
              onClick={(e) => {
                // Stay open while it runs, so a failure can be shown here.
                e.preventDefault();
                del.mutate();
              }}
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
