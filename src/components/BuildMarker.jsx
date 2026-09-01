import { useEffect, useState } from "react";
import { BUILD_SHA, BUILD_BRANCH, RELEASE_BRANCH } from "../build.js";
import { getHealth } from "../api/client.js";

/**
 * Says what is running, but only when that is worth saying (KAN-63).
 *
 * Inverted on purpose. A version in the footer is furniture: it is read once
 * and then stops being seen, so it cannot warn anybody of anything. A marker
 * that is normally absent means its presence is itself the information —
 * seeing it on a phone says "this is code that has not earned `main` yet",
 * and a clean deploy is silent.
 *
 * It also carries the check the manual runbook most needs. Deploying is two
 * steps in a required order, so a backend updated without its frontend is the
 * easiest mistake available, and it presents as a feature misbehaving rather
 * than as an error. Comparing the bundle's commit against the one the API
 * reports turns that into a sentence.
 *
 * Props exist so the states can be tested without rebuilding the bundle;
 * nothing passes them in the app.
 */
export default function BuildMarker({ sha = BUILD_SHA, branch = BUILD_BRANCH }) {
  const [apiSha, setApiSha] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((data) => {
        if (!cancelled) setApiSha(data?.build?.sha ?? null);
      })
      // An unreachable API is the list's story to tell, not this component's.
      // Staying quiet here avoids two complaints about one outage.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Only a disagreement between two *known* commits means anything. An
  // unknown on either side is an unstamped build, which is not a mismatch.
  const known = sha !== "unknown" && apiSha && apiSha !== "unknown";
  const mismatch = Boolean(known && apiSha !== sha);

  if (branch === RELEASE_BRANCH && !mismatch) return null;

  return (
    <div
      className={`build-marker${mismatch ? " build-marker-warn" : ""}`}
      role="status"
    >
      {mismatch ? (
        <>
          <strong>Half-deployed:</strong> this page is {sha}, the API is{" "}
          {apiSha}
        </>
      ) : (
        <>
          {branch} @ {sha}
        </>
      )}
    </div>
  );
}
