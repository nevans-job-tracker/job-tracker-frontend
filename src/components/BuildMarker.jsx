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
  const [api, setApi] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((data) => {
        if (!cancelled) setApi(data?.build ?? null);
      })
      // An unreachable API is the list's story to tell, not this component's.
      // Staying quiet here avoids two complaints about one outage.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Branches, not commits.
  //
  // The frontend and the backend are separate repositories with independent
  // histories, so their SHAs are never equal and comparing them would report
  // "half-deployed" on every load, forever. Branch names are the one thing
  // the two repositories genuinely share.
  //
  // Narrower than the check this was meant to be: a frontend that was never
  // rebuilt after its backend moved is still on the same branch and passes.
  // What it does catch is halves deployed from different branches, which is
  // the state where the two are running unrelated code.
  //
  // Only a disagreement between two *known* branches counts. An unknown on
  // either side is an unstamped build, not a disagreement.
  const apiBranch = api?.branch;
  const known =
    branch !== "unknown" && apiBranch && apiBranch !== "unknown";
  const mismatch = Boolean(known && apiBranch !== branch);

  if (branch === RELEASE_BRANCH && !mismatch) return null;

  return (
    <div
      className={`build-marker${mismatch ? " build-marker-warn" : ""}`}
      role="status"
    >
      {mismatch ? (
        <>
          <strong>Half-deployed:</strong> this page was built from {branch},
          the API is running {apiBranch}
        </>
      ) : (
        <>
          {branch} @ {sha}
          {/* The API's own commit, shown rather than compared. Two
              repositories, so the two SHAs are unrelated by construction —
              but the operator still wants both of them. */}
          {api?.sha ? ` · api ${api.sha}` : ""}
        </>
      )}
    </div>
  );
}
