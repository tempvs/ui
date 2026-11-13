import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import RefreshingImage from "../image/RefreshingImage";
import { replaceProfileImage } from "./profileApi";

function response(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

afterEach(() => jest.restoreAllMocks());

test("a replacement is previewed immediately and switches to its processed version without reloading", async () => {
  const old = { id: "avatar-replacement", resourceType: "profile", resourceId: "profile-preview", url: "https://images/old", activeVersionId: "version-old" };
  const pending = { ...old, processing: { versionId: "version-new", status: "PENDING" } };
  const fetchMock = jest.spyOn(global, "fetch")
    .mockResolvedValueOnce(response({ image: pending, upload: { method: "PUT", url: "https://upload/photo", headers: {} } }))
    .mockResolvedValueOnce(response({}))
    // A replacement still has the old READY image and usable URL while processing.
    .mockResolvedValueOnce(response({ content: [pending] }))
    .mockResolvedValueOnce(response({ content: [{ ...old, activeVersionId: "version-new", url: "https://images/new" }] }));
  const view = render(<RefreshingImage image={old} alt="Profile" />);
  expect(screen.getByAltText("Profile")).toHaveAttribute("src", old.url);
  const uploaded = await replaceProfileImage("profile-preview", old.id, new File(["new pixels"], "profile.png", { type: "image/png" }));
  view.rerender(<RefreshingImage image={uploaded} alt="Profile" />);
  expect(screen.getByAltText("Profile").getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(screen.getByAltText("Profile")).not.toHaveAttribute("src", old.url);
  await waitFor(() => expect(screen.getByAltText("Profile")).toHaveAttribute("src", "https://images/new"), { timeout: 2000 });
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test("a failed storage upload never returns a successful local preview", async () => {
  jest.spyOn(global, "fetch")
    .mockResolvedValueOnce(response({ image: { id: "failed" }, upload: { method: "PUT", url: "https://upload/photo", headers: {} } }))
    .mockResolvedValueOnce(response({}, false));
  await expect(replaceProfileImage("profile", "failed", new File(["pixels"], "photo.png", { type: "image/png" }))).rejects.toThrow("Profile picture upload failed");
});
