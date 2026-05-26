import { type Locator, expect } from "@playwright/test";

// Set an <input type="range"> to a target value the way a keyboard user
// would: focus, jump to min with Home, then step up with ArrowRight. Falls
// back to a native value-setter + input event (React-compatible) if the
// keyboard path doesn't land exactly.
export async function setRange(locator: Locator, value: number): Promise<void> {
  const min = Number((await locator.getAttribute("min")) ?? 0);
  const max = Number((await locator.getAttribute("max")) ?? 100);
  const step = Number((await locator.getAttribute("step")) || 1);
  const target = Math.min(max, Math.max(min, value));

  await locator.focus();
  await locator.press("Home");
  let cur = min;
  let guard = 0;
  while (cur < target && guard < 200) {
    await locator.press("ArrowRight");
    cur += step;
    guard++;
  }

  if (Number(await locator.inputValue()) !== target) {
    await locator.evaluate((el: HTMLInputElement, v: number) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, target);
  }

  await expect(locator).toHaveValue(String(target));
}
