import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/hooks/useProfile";

type Result = { ok: boolean; status: number; body: any } | null;

function ResultBlock({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <pre
      className={`mt-2 max-h-96 overflow-auto rounded-md p-3 text-xs ${
        result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
      }`}
    >
      {`HTTP ${result.status}\n\n` + JSON.stringify(result.body, null, 2)}
    </pre>
  );
}

async function invoke(fn: string, body: any): Promise<Result> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) {
      // supabase-js wraps non-2xx as FunctionsHttpError; try to get body via context
      const ctx: any = (error as any).context;
      let parsed: any = null;
      try { parsed = ctx ? await ctx.json() : null; } catch { parsed = error.message; }
      return { ok: false, status: ctx?.status ?? 0, body: parsed ?? error.message };
    }
    return { ok: true, status: 200, body: data };
  } catch (e: any) {
    return { ok: false, status: 0, body: String(e?.message ?? e) };
  }
}

export default function BundleSocialSmokeTest() {
  const { profile } = useProfile();
  const [profileUserId, setProfileUserId] = useState("");
  const [postId, setPostId] = useState("");
  const [trigger, setTrigger] = useState<"manual" | "cron">("manual");

  const [createRes, setCreateRes] = useState<Result>(null);
  const [linkRes, setLinkRes] = useState<Result>(null);
  const [publishRes, setPublishRes] = useState<Result>(null);

  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<Result>, setter: (r: Result) => void) => {
    setBusy(key);
    setter(await fn());
    setBusy(null);
  };

  const myUid = profile?.user_id ?? "";

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Bundle.social Smoke Test</h1>
        <p className="text-sm text-muted-foreground">
          Calls each Bundle.social edge function with the supplied input and shows the raw response.
          Signed-in user: <code>{myUid || "(not signed in)"}</code>
          {profile?.bundle_social_team_id && (
            <> · team: <code>{profile.bundle_social_team_id}</code></>
          )}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>1. create-team</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label>profileUserId (admin only)</Label>
          <Input
            value={profileUserId}
            onChange={(e) => setProfileUserId(e.target.value)}
            placeholder={myUid || "user uuid"}
          />
          <Button
            disabled={busy !== null}
            onClick={() =>
              run("create", () => invoke("bundle-social-create-team", {
                profileUserId: profileUserId || myUid,
              }), setCreateRes)
            }
          >
            {busy === "create" ? "Calling…" : "Call create-team"}
          </Button>
          <ResultBlock result={createRes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. get-connect-link</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label>profileUserId (optional — defaults to self)</Label>
          <Input
            value={profileUserId}
            onChange={(e) => setProfileUserId(e.target.value)}
            placeholder={myUid || "user uuid"}
          />
          <Button
            disabled={busy !== null}
            onClick={() =>
              run("link", () => invoke("bundle-social-get-connect-link",
                profileUserId ? { profileUserId } : {}
              ), setLinkRes)
            }
          >
            {busy === "link" ? "Calling…" : "Call get-connect-link"}
          </Button>
          {linkRes?.ok && linkRes.body?.url && (
            <a
              href={linkRes.body.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline break-all"
            >
              Open connect URL ↗
            </a>
          )}
          <ResultBlock result={linkRes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. publish-post</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={trigger === "manual" ? "default" : "outline"}
              onClick={() => setTrigger("manual")}
            >
              Manual (postId)
            </Button>
            <Button
              size="sm"
              variant={trigger === "cron" ? "default" : "outline"}
              onClick={() => setTrigger("cron")}
            >
              Cron sweep
            </Button>
          </div>
          {trigger === "manual" && (
            <>
              <Label>postId (channel_posts.id)</Label>
              <Input
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                placeholder="uuid of a channel_posts row"
              />
            </>
          )}
          <Button
            disabled={busy !== null || (trigger === "manual" && !postId)}
            onClick={() =>
              run("publish", () => invoke(
                "bundle-social-publish-post",
                trigger === "cron" ? { trigger: "cron" } : { postId }
              ), setPublishRes)
            }
          >
            {busy === "publish" ? "Calling…" : "Call publish-post"}
          </Button>
          <ResultBlock result={publishRes} />
        </CardContent>
      </Card>
    </div>
  );
}
