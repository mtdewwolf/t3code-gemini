import { describe, expect, it } from "vitest";
import {
  CURSOR_MODEL_FAMILY_OPTIONS,
  CURSOR_REASONING_OPTIONS,
  DEFAULT_MODEL,
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_REASONING_EFFORT_BY_PROVIDER,
  MODEL_OPTIONS,
  MODEL_OPTIONS_BY_PROVIDER,
  CODEX_REASONING_EFFORT_OPTIONS,
} from "@t3tools/contracts";

import {
  applyClaudePromptEffortPrefix,
  getDefaultModel,
  getDefaultReasoningEffort,
  getCursorModelFamilyOptions,
  getModelCapabilities,
  getModelOptions,
  isClaudeUltrathinkPrompt,
  normalizeClaudeModelOptions,
  normalizeCodexModelOptions,
  normalizeModelSlug,
  parseCursorModelSelection,
  resolveCursorPickerModelSlug,
  resolveCursorModelFromSelection,
  resolveReasoningEffortForProvider,
  resolveSelectableModel,
  resolveModelSlug,
  resolveModelSlugForProvider,
  getDefaultEffort,
  getReasoningEffortOptions,
  hasEffortLevel,
  inferProviderForModel,
} from "./model";

describe("normalizeModelSlug", () => {
  it("maps known aliases to canonical slugs", () => {
    expect(normalizeModelSlug("5.3")).toBe("gpt-5.3-codex");
    expect(normalizeModelSlug("gpt-5.3")).toBe("gpt-5.3-codex");
  });

  it("returns null for empty or missing values", () => {
    expect(normalizeModelSlug("")).toBeNull();
    expect(normalizeModelSlug("   ")).toBeNull();
    expect(normalizeModelSlug(null)).toBeNull();
    expect(normalizeModelSlug(undefined)).toBeNull();
  });

  it("preserves non-aliased model slugs", () => {
    expect(normalizeModelSlug("gpt-5.2")).toBe("gpt-5.2");
    expect(normalizeModelSlug("gpt-5.2-codex")).toBe("gpt-5.2-codex");
  });

  it("uses provider-specific aliases", () => {
    expect(normalizeModelSlug("sonnet", "claudeAgent")).toBe("claude-sonnet-4-6");
    expect(normalizeModelSlug("opus-4.6", "claudeAgent")).toBe("claude-opus-4-6");
    expect(normalizeModelSlug("claude-haiku-4-5-20251001", "claudeAgent")).toBe("claude-haiku-4-5");
    expect(normalizeModelSlug("composer", "cursor")).toBe("composer-1.5");
    expect(normalizeModelSlug("gpt-5.3-codex-spark", "cursor")).toBe("gpt-5.3-codex-spark-preview");
    expect(normalizeModelSlug("gpt-5.4", "cursor")).toBe("gpt-5.4-medium");
    expect(normalizeModelSlug("gpt-5.2-codex", "cursor")).toBe("gpt-5.2-codex");
    expect(normalizeModelSlug("gemini-3.1", "cursor")).toBe("gemini-3.1-pro");
    expect(normalizeModelSlug("claude-4.6-sonnet-thinking", "cursor")).toBe("sonnet-4.6-thinking");
    expect(normalizeModelSlug("claude-4.5-sonnet-thinking", "cursor")).toBe("sonnet-4.5-thinking");
  });

  it("does not leak prototype properties as aliases", () => {
    expect(normalizeModelSlug("toString")).toBe("toString");
    expect(normalizeModelSlug("constructor")).toBe("constructor");
  });

  it("uses provider-specific aliases", () => {
    expect(normalizeModelSlug("sonnet", "claudeAgent")).toBe("claude-sonnet-4-6");
    expect(normalizeModelSlug("opus-4.6", "claudeAgent")).toBe("claude-opus-4-6");
    expect(normalizeModelSlug("claude-haiku-4-5-20251001", "claudeAgent")).toBe("claude-haiku-4-5");
  });
});

describe("resolveModelSlug", () => {
  it("returns default only when the model is missing", () => {
    expect(resolveModelSlug(undefined)).toBe(DEFAULT_MODEL);
    expect(resolveModelSlug(null)).toBe(DEFAULT_MODEL);
  });

  it("preserves unknown custom models", () => {
    expect(resolveModelSlug("gpt-4.1")).toBe(DEFAULT_MODEL);
    expect(resolveModelSlug("custom/internal-model")).toBe(DEFAULT_MODEL);
  });

  it("resolves only supported model options", () => {
    for (const model of MODEL_OPTIONS) {
      expect(resolveModelSlug(model.slug)).toBe(model.slug);
    }
  });

  it("supports provider-aware resolution", () => {
    expect(resolveModelSlugForProvider("claudeAgent", undefined)).toBe(
      DEFAULT_MODEL_BY_PROVIDER.claudeAgent,
    );
    expect(resolveModelSlugForProvider("claudeAgent", "sonnet")).toBe("claude-sonnet-4-6");
    expect(resolveModelSlugForProvider("claudeAgent", "gpt-5.3-codex")).toBe(
      DEFAULT_MODEL_BY_PROVIDER.claudeAgent,
    );
    expect(resolveModelSlugForProvider("cursor", undefined)).toBe(DEFAULT_MODEL_BY_PROVIDER.cursor);
    expect(resolveModelSlugForProvider("cursor", "composer")).toBe("composer-1.5");
    expect(resolveModelSlugForProvider("cursor", "gpt-5.3-codex-high-fast")).toBe(
      "gpt-5.3-codex-high-fast",
    );
    expect(resolveModelSlugForProvider("cursor", "claude-sonnet-4-6")).toBe(
      DEFAULT_MODEL_BY_PROVIDER.cursor,
    );
  });

  it("keeps codex defaults for backward compatibility", () => {
    expect(getDefaultModel()).toBe(DEFAULT_MODEL);
    expect(getModelOptions()).toEqual(MODEL_OPTIONS);
    expect(getModelOptions("claudeAgent")).toEqual(MODEL_OPTIONS_BY_PROVIDER.claudeAgent);
    expect(getModelOptions("cursor")).toEqual(MODEL_OPTIONS_BY_PROVIDER.cursor);
    expect(getCursorModelFamilyOptions()).toEqual(CURSOR_MODEL_FAMILY_OPTIONS);
  });
});

describe("cursor model selection", () => {
  it("includes the expected cursor reasoning levels and families", () => {
    expect(CURSOR_REASONING_OPTIONS).toEqual(["low", "normal", "high", "xhigh"]);
    expect(getCursorModelFamilyOptions().map((option) => option.slug)).toContain("gpt-5.3-codex");
    expect(getCursorModelFamilyOptions().map((option) => option.slug)).toContain("gpt-5.2-codex");
    expect(getCursorModelFamilyOptions().map((option) => option.slug)).toContain("gpt-5.4-medium");
    expect(getCursorModelFamilyOptions().map((option) => option.slug)).toContain("opus-4.6");
    expect(getCursorModelFamilyOptions().map((option) => option.slug)).toContain("sonnet-4.5");
  });

  it("parses codex reasoning and fast mode variants", () => {
    expect(parseCursorModelSelection("gpt-5.3-codex-high-fast")).toEqual({
      family: "gpt-5.3-codex",
      reasoning: "high",
      fast: true,
      thinking: false,
    });
    expect(parseCursorModelSelection("gpt-5.2-codex")).toEqual({
      family: "gpt-5.2-codex",
      reasoning: "normal",
      fast: false,
      thinking: false,
    });
  });

  it("parses newer cursor codex reasoning variants", () => {
    expect(parseCursorModelSelection("gpt-5.2-codex-high-fast")).toEqual({
      family: "gpt-5.2-codex",
      reasoning: "high",
      fast: true,
      thinking: false,
    });
    expect(
      resolveCursorModelFromSelection({
        family: "gpt-5.2-codex",
        reasoning: "xhigh",
        fast: true,
      }),
    ).toBe("gpt-5.2-codex-xhigh-fast");
  });

  it("parses and resolves thinking variants", () => {
    expect(parseCursorModelSelection("sonnet-4.6-thinking")).toEqual({
      family: "sonnet-4.6",
      reasoning: "normal",
      fast: false,
      thinking: true,
    });
    expect(
      resolveCursorModelFromSelection({
        family: "sonnet-4.6",
        thinking: true,
      }),
    ).toBe("sonnet-4.6-thinking");
    expect(parseCursorModelSelection("sonnet-4.5-thinking")).toEqual({
      family: "sonnet-4.5",
      reasoning: "normal",
      fast: false,
      thinking: true,
    });
  });

  it("resolves codex family selections into concrete model ids", () => {
    expect(
      resolveCursorModelFromSelection({
        family: "gpt-5.3-codex",
        reasoning: "xhigh",
        fast: true,
      }),
    ).toBe("gpt-5.3-codex-xhigh-fast");
  });

  it("collapses trait-backed cursor variants to a single picker option", () => {
    expect(resolveCursorPickerModelSlug("gpt-5.2-codex-high-fast")).toBe("gpt-5.2-codex");
    expect(resolveCursorPickerModelSlug("opus-4.6-thinking")).toBe("opus-4.6");
    expect(resolveCursorPickerModelSlug("sonnet-4.5-thinking")).toBe("sonnet-4.5");
    expect(resolveCursorPickerModelSlug("gpt-5.4-high-fast")).toBe("gpt-5.4-high-fast");
  });
});

describe("resolveSelectableModel", () => {
  it("resolves exact slug matches", () => {
    expect(
      resolveSelectableModel("codex", "gpt-5.3-codex", [
        { slug: "gpt-5.4", name: "GPT-5.4" },
        { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
      ]),
    ).toBe("gpt-5.3-codex");
  });

  it("resolves case-insensitive display-name matches", () => {
    expect(
      resolveSelectableModel("codex", "gpt-5.3 codex", [
        { slug: "gpt-5.4", name: "GPT-5.4" },
        { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
      ]),
    ).toBe("gpt-5.3-codex");
  });

  it("resolves provider-specific aliases after normalization", () => {
    expect(
      resolveSelectableModel("claudeAgent", "sonnet", [
        { slug: "claude-opus-4-6", name: "Claude Opus 4.6" },
        { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      ]),
    ).toBe("claude-sonnet-4-6");
  });

  it("returns null for empty input", () => {
    expect(resolveSelectableModel("codex", "", [{ slug: "gpt-5.4", name: "GPT-5.4" }])).toBeNull();
    expect(
      resolveSelectableModel("codex", "   ", [{ slug: "gpt-5.4", name: "GPT-5.4" }]),
    ).toBeNull();
    expect(
      resolveSelectableModel("codex", null, [{ slug: "gpt-5.4", name: "GPT-5.4" }]),
    ).toBeNull();
  });

  it("returns null for unknown values that are not present in options", () => {
    expect(
      resolveSelectableModel("codex", "gpt-4.1", [{ slug: "gpt-5.4", name: "GPT-5.4" }]),
    ).toBeNull();
  });

  it("does not accept normalized custom-looking slugs unless they exist in options", () => {
    expect(
      resolveSelectableModel("codex", "custom/internal-model", [
        { slug: "gpt-5.4", name: "GPT-5.4" },
      ]),
    ).toBeNull();
  });

  it("respects provider boundaries", () => {
    expect(
      resolveSelectableModel("codex", "sonnet", [{ slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" }]),
    ).toBeNull();
    expect(
      resolveSelectableModel("claudeAgent", "5.3", [
        { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      ]),
    ).toBeNull();
  });
});

describe("getModelCapabilities reasoningEffortLevels", () => {
  const values = (provider: "codex" | "claudeAgent", model: string | null) =>
    getModelCapabilities(provider, model).reasoningEffortLevels.map((l) => l.value);

  it("returns codex reasoning options for codex", () => {
    expect(values("codex", "gpt-5.4")).toEqual([...CODEX_REASONING_EFFORT_OPTIONS]);
  });

  it("returns claude effort options for Opus 4.6", () => {
    expect(values("claudeAgent", "claude-opus-4-6")).toEqual([
      "low",
      "medium",
      "high",
      "max",
      "ultrathink",
    ]);
  });

  it("returns claude effort options for Sonnet 4.6", () => {
    expect(values("claudeAgent", "claude-sonnet-4-6")).toEqual([
      "low",
      "medium",
      "high",
      "ultrathink",
    ]);
  });

  it("returns no claude effort options for Haiku 4.5", () => {
    expect(getReasoningEffortOptions("claudeAgent", "claude-haiku-4-5")).toEqual([]);
  });

  it("returns no reasoning options for cursor", () => {
    expect(getReasoningEffortOptions("cursor")).toEqual([]);
  });
});

describe("inferProviderForModel", () => {
  it("detects known provider model slugs", () => {
    expect(inferProviderForModel("gpt-5.3-codex")).toBe("codex");
    expect(inferProviderForModel("claude-sonnet-4-6")).toBe("claudeAgent");
    expect(inferProviderForModel("sonnet")).toBe("claudeAgent");
  });

  it("co-locates labels with effort values", () => {
    const levels = getModelCapabilities("claudeAgent", "claude-opus-4-6").reasoningEffortLevels;
    const high = levels.find((l) => l.value === "high");
    expect(high).toEqual({ value: "high", label: "High", isDefault: true });
    const xhigh = getModelCapabilities("codex", "gpt-5.4").reasoningEffortLevels.find(
      (l) => l.value === "xhigh",
    );
    expect(xhigh).toEqual({ value: "xhigh", label: "Extra High" });
    expect(getDefaultReasoningEffort("cursor")).toBe(DEFAULT_REASONING_EFFORT_BY_PROVIDER.cursor);
  });
});

describe("getDefaultEffort", () => {
  it("returns the default effort from capabilities", () => {
    expect(getDefaultEffort(getModelCapabilities("codex", "gpt-5.4"))).toBe("high");
    expect(getDefaultEffort(getModelCapabilities("claudeAgent", "claude-opus-4-6"))).toBe("high");
    expect(getDefaultEffort(getModelCapabilities("claudeAgent", "claude-haiku-4-5"))).toBeNull();
  });
});

describe("hasEffortLevel", () => {
  it("validates effort against model capabilities", () => {
    const opusCaps = getModelCapabilities("claudeAgent", "claude-opus-4-6");
    expect(hasEffortLevel(opusCaps, "max")).toBe(true);
    expect(hasEffortLevel(opusCaps, "xhigh")).toBe(false);

    const codexCaps = getModelCapabilities("codex", "gpt-5.4");
    expect(hasEffortLevel(codexCaps, "xhigh")).toBe(true);
    expect(hasEffortLevel(codexCaps, "max")).toBe(false);
  });
});

describe("applyClaudePromptEffortPrefix", () => {
  it("prefixes ultrathink prompts exactly once", () => {
    expect(applyClaudePromptEffortPrefix("Investigate this", "ultrathink")).toBe(
      "Ultrathink:\nInvestigate this",
    );
    expect(applyClaudePromptEffortPrefix("Ultrathink:\nInvestigate this", "ultrathink")).toBe(
      "Ultrathink:\nInvestigate this",
    );
  });

  it("leaves non-ultrathink prompts unchanged", () => {
    expect(applyClaudePromptEffortPrefix("Investigate this", "high")).toBe("Investigate this");
  });
});

describe("normalizeCodexModelOptions", () => {
  it("drops default-only codex options", () => {
    expect(
      normalizeCodexModelOptions("gpt-5.4", { reasoningEffort: "high", fastMode: false }),
    ).toBeUndefined();
  });

  it("preserves non-default codex options", () => {
    expect(
      normalizeCodexModelOptions("gpt-5.4", { reasoningEffort: "xhigh", fastMode: true }),
    ).toEqual({
      reasoningEffort: "xhigh",
      fastMode: true,
    });
  });
});

describe("normalizeClaudeModelOptions", () => {
  it("drops unsupported fast mode and max effort for Sonnet", () => {
    expect(
      normalizeClaudeModelOptions("claude-sonnet-4-6", {
        effort: "max",
        fastMode: true,
      }),
    ).toBeUndefined();
  });

  it("keeps the Haiku thinking toggle and removes unsupported effort", () => {
    expect(
      normalizeClaudeModelOptions("claude-haiku-4-5", {
        thinking: false,
        effort: "high",
      }),
    ).toEqual({
      thinking: false,
    });
  });
});

describe("getModelCapabilities Claude capability flags", () => {
  it("only enables adaptive reasoning for Opus 4.6 and Sonnet 4.6", () => {
    const has = (m: string | undefined) =>
      getModelCapabilities("claudeAgent", m).reasoningEffortLevels.length > 0;
    expect(has("claude-opus-4-6")).toBe(true);
    expect(has("claude-sonnet-4-6")).toBe(true);
    expect(has("claude-haiku-4-5")).toBe(false);
    expect(has(undefined)).toBe(false);
  });

  it("only enables max effort for Opus 4.6", () => {
    const has = (m: string | undefined) =>
      getModelCapabilities("claudeAgent", m).reasoningEffortLevels.some((l) => l.value === "max");
    expect(has("claude-opus-4-6")).toBe(true);
    expect(has("claude-sonnet-4-6")).toBe(false);
    expect(has("claude-haiku-4-5")).toBe(false);
    expect(has(undefined)).toBe(false);
  });

  it("only enables Claude fast mode for Opus 4.6", () => {
    const has = (m: string | undefined) => getModelCapabilities("claudeAgent", m).supportsFastMode;
    expect(has("claude-opus-4-6")).toBe(true);
    expect(has("opus")).toBe(true);
    expect(has("claude-sonnet-4-6")).toBe(false);
    expect(has("claude-haiku-4-5")).toBe(false);
    expect(has(undefined)).toBe(false);
  });

  it("only enables ultrathink keyword handling for Opus 4.6 and Sonnet 4.6", () => {
    const has = (m: string | undefined) =>
      getModelCapabilities("claudeAgent", m).reasoningEffortLevels.length > 0;
    expect(has("claude-opus-4-6")).toBe(true);
    expect(has("claude-sonnet-4-6")).toBe(true);
    expect(has("claude-haiku-4-5")).toBe(false);
  });

  it("only enables the Claude thinking toggle for Haiku 4.5", () => {
    const has = (m: string | undefined) =>
      getModelCapabilities("claudeAgent", m).supportsThinkingToggle;
    expect(has("claude-opus-4-6")).toBe(false);
    expect(has("claude-sonnet-4-6")).toBe(false);
    expect(has("claude-haiku-4-5")).toBe(true);
    expect(has("haiku")).toBe(true);
    expect(has(undefined)).toBe(false);
  });
});

describe("isClaudeUltrathinkPrompt", () => {
  it("detects ultrathink prompts case-insensitively", () => {
    expect(isClaudeUltrathinkPrompt("Please ultrathink about this")).toBe(true);
    expect(isClaudeUltrathinkPrompt("Ultrathink:\nInvestigate")).toBe(true);
    expect(isClaudeUltrathinkPrompt("Think hard about this")).toBe(false);
    expect(isClaudeUltrathinkPrompt(undefined)).toBe(false);
  });
});
