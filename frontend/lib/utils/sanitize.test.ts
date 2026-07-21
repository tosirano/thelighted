/**
 * sanitize.test.ts
 *
 * Unit tests for the sanitize() and stripTags() utilities.
 * Tests run in jsdom (Next.js / Jest default) which provides window + DOMPurify DOM.
 */

import { sanitize, stripTags } from "./sanitize";

describe("sanitize()", () => {
  it("passes plain text through unchanged", () => {
    expect(sanitize("Hello, world!")).toBe("Hello, world!");
  });

  it("strips <script> tags and their content", () => {
    const result = sanitize("<script>alert(1)</script>Safe text");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Safe text");
  });

  it("strips inline event handler attributes", () => {
    const result = sanitize('<b onclick="evil()">Bold</b>');
    expect(result).not.toContain("onclick");
    expect(result).toContain("Bold");
  });

  it("strips javascript: URI in anchor href", () => {
    const result = sanitize('<a href="javascript:evil()">Click me</a>');
    expect(result).not.toContain("javascript:");
  });

  it("strips data: URI attributes", () => {
    const result = sanitize('<img src="data:text/html,<script>alert(1)</script>">');
    expect(result).not.toContain("data:");
  });

  it("allows safe inline formatting tags", () => {
    const input = "<b>Bold</b> and <em>italic</em> and <br>";
    const result = sanitize(input);
    expect(result).toContain("<b>Bold</b>");
    expect(result).toContain("<em>italic</em>");
  });

  it("handles empty string without throwing", () => {
    expect(sanitize("")).toBe("");
  });

  it("handles deeply nested XSS attempt", () => {
    const result = sanitize('<div><p><span onmouseover="evil()">text</span></p></div>');
    expect(result).not.toContain("onmouseover");
  });
});

describe("stripTags()", () => {
  it("removes all HTML tags leaving plain text", () => {
    expect(stripTags("<b>Hello</b> world")).toBe("Hello world");
  });

  it("removes script tags", () => {
    expect(stripTags("<script>alert(1)</script>text")).not.toContain("<script>");
  });
});