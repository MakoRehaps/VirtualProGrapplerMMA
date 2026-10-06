import { describe, expect, it } from "vitest";
import {
  ACTIVE_COMBAT_PROFILE,
  isTechniqueActive,
  techniqueById,
} from "@/data/combatCatalog";

describe("active combat profile", () => {
  it("keeps submissions disabled in stand-up Kumite", () => {
    const armbar = techniqueById("armbar");
    const choke = techniqueById("rear_naked_choke");

    expect(ACTIVE_COMBAT_PROFILE.profile_id).toBe(
      "may_quv_standup_pride"
    );
    expect(armbar).not.toBeNull();
    expect(choke).not.toBeNull();
    expect(isTechniqueActive(armbar!)).toBe(false);
    expect(isTechniqueActive(choke!)).toBe(false);
  });

  it("keeps the short grounded-opponent PRIDE window active", () => {
    const soccerKick = techniqueById("soccer_kick_head");
    const stomp = techniqueById("stomp_body");

    expect(soccerKick).not.toBeNull();
    expect(stomp).not.toBeNull();
    expect(isTechniqueActive(soccerKick!)).toBe(true);
    expect(isTechniqueActive(stomp!)).toBe(true);
  });
});
