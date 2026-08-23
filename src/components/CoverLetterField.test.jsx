import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoverLetterField from "./CoverLetterField.jsx";
import { convertDocx, DocxError } from "../docx.js";
import { downloadCoverLetter } from "../coverLetter.js";

// The conversion itself is mammoth's job and is covered in docx.test.js
// against the real library; here the question is what the field does with the
// result, including when it refuses.
vi.mock("../docx.js", async (importOriginal) => ({
  ...(await importOriginal()),
  convertDocx: vi.fn(),
}));
vi.mock("../coverLetter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  downloadCoverLetter: vi.fn(),
}));

function setup({ value = "", company = "Acme Corp" } = {}) {
  const onChange = vi.fn();
  const view = render(
    <CoverLetterField value={value} company={company} onChange={onChange} />
  );
  return { onChange, view };
}

const upload = async (file) =>
  userEvent.upload(screen.getByTestId("cover-letter-file"), file);

const docxFile = (name = "letter.docx") =>
  new File(["binary"], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

beforeEach(() => vi.clearAllMocks());

describe("CoverLetterField", () => {
  describe("which state it opens in", () => {
    it("starts editable when there is nothing to preview", () => {
      setup();
      expect(screen.getByRole("textbox", { name: /cover letter/i })).toBeInTheDocument();
    });

    it("starts as a preview when there is a letter", () => {
      setup({ value: "<p>Dear all,</p>" });
      expect(screen.getByText("Dear all,")).toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: /cover letter/i })
      ).not.toBeInTheDocument();
    });

    it("offers no Edit or Download while empty", () => {
      setup();
      expect(screen.queryByRole("button", { name: /edit as text/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /download/i })).toBeDisabled();
    });
  });

  describe("prose and HTML both render", () => {
    it("renders stored HTML as a letter", () => {
      setup({ value: "<p>First</p><p>Second <strong>bold</strong></p>" });
      expect(screen.getByText("bold").tagName).toBe("STRONG");
    });

    it("renders plain prose written before any .docx existed", () => {
      // No format flag on the row and no migration — the ambiguity is
      // resolved on read.
      setup({ value: "Dear all,\n\nThanks for your time." });
      expect(screen.getByText("Dear all,")).toBeInTheDocument();
      expect(screen.getByText("Thanks for your time.")).toBeInTheDocument();
    });

    it("hands back prose, not markup, when switching to editing", async () => {
      setup({ value: "<p>Dear all,</p>\n<p>Thanks.</p>" });
      await userEvent.click(screen.getByRole("button", { name: /edit as text/i }));

      const box = screen.getByRole("textbox", { name: /cover letter/i });
      expect(box).toHaveValue("Dear all,\n\nThanks.");
      expect(box.value).not.toContain("<p>");
    });
  });

  describe("uploading a .docx", () => {
    it("stores the converted HTML and shows it", async () => {
      convertDocx.mockResolvedValue("<p>Converted <strong>letter</strong></p>");
      const { onChange } = setup();

      await upload(docxFile());
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith("<p>Converted <strong>letter</strong></p>")
      );
    });

    it("leaves editing mode, since there is now something to preview", async () => {
      convertDocx.mockResolvedValue("<p>Converted</p>");
      const { view } = setup();
      await upload(docxFile());

      await waitFor(() => expect(convertDocx).toHaveBeenCalled());
      view.rerender(
        <CoverLetterField value="<p>Converted</p>" company="Acme" onChange={vi.fn()} />
      );
      expect(screen.getByText("Converted")).toBeInTheDocument();
    });

    it("surfaces a refusal instead of failing silently", async () => {
      // What convertDocx refuses, and why, is its own test's business — the
      // input's accept filter means userEvent will not even hand a PDF over.
      // Here the only question is whether a rejection reaches the screen.
      convertDocx.mockRejectedValue(new DocxError("That .docx has no text in it."));
      const { onChange } = setup();

      await upload(docxFile());
      expect(
        await screen.findByText("That .docx has no text in it.")
      ).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clears the input so the same file can be chosen twice", async () => {
      // Without this, fixing a document and re-uploading it silently does
      // nothing, because the input's value has not changed.
      convertDocx.mockResolvedValue("<p>One</p>");
      setup();
      const input = screen.getByTestId("cover-letter-file");
      await upload(docxFile());
      await waitFor(() => expect(convertDocx).toHaveBeenCalledTimes(1));
      expect(input.value).toBe("");
    });

    it("opens the file picker from the visible button", async () => {
      // The other upload tests drive the hidden input directly, so without
      // this the button could be wired to nothing and they would all pass.
      setup();
      const input = screen.getByTestId("cover-letter-file");
      const click = vi.spyOn(input, "click").mockImplementation(() => {});

      await userEvent.click(screen.getByRole("button", { name: /upload \.docx/i }));
      expect(click).toHaveBeenCalled();
    });

    it("says Replace rather than Upload once there is a letter", () => {
      setup({ value: "<p>Dear all,</p>" });
      expect(screen.getByRole("button", { name: /replace with \.docx/i })).toBeInTheDocument();
    });
  });

  describe("download", () => {
    it("exports what is on screen, not what was last saved", async () => {
      setup({ value: "<p>Dear all,</p>", company: "Acme Corp" });
      await userEvent.click(screen.getByRole("button", { name: /download/i }));
      expect(downloadCoverLetter).toHaveBeenCalledWith("<p>Dear all,</p>", "Acme Corp");
    });
  });
});
