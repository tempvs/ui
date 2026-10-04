import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import PhotoAlbumsPanel from "./PhotoAlbumsPanel";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

test("shows a pending album image immediately and saves album metadata on blur", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "/api/images/albums/profile/profile-1")
      return response({ content: [{ id: "album-1", name: "Summer", description: "Campaign photos" }] });
    if (url === "/api/images/lookup") return response({ content: [] });
    if (url === "/api/images/album/album-1?limit=100") return response({ content: [] });
    if (url.startsWith("/api/images/album/album-1?limit=1&imageIds=image-1"))
      return response({ content: [{ id: "image-1", fileName: "camp.png" }] });
    if (url === "/api/images/album/album-1")
      return response({
        image: { id: "image-1", fileName: "camp.png", description: null },
        upload: { method: "PUT", url: "https://upload.example.test/camp.png", headers: {} },
      }, init?.method === "POST" ? 201 : 200);
    if (url === "https://upload.example.test/camp.png") return response({});
    if (url === "/api/images/albums/album-1")
      return response({ id: "album-1", name: "Summer photos", description: "Campaign photos" });
    throw new Error(`Unexpected request: ${url}`);
  });

  render(
    <PhotoAlbumsPanel targetType="profile" targetId="profile-1" editable />,
  );

  fireEvent.click(await screen.findByRole("button", { name: /summer campaign photos/i }));

  await screen.findByRole("button", { name: "Add image" });

  expect(screen.queryByText("Photo album")).not.toBeInTheDocument();
  expect(screen.getByDisplayValue("Summer")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Campaign photos")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete album" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save album" })).not.toBeInTheDocument();

  const name = screen.getByDisplayValue("Summer");
  fireEvent.click(name);
  await waitFor(() => expect(name).not.toHaveAttribute("readonly"));
  fireEvent.change(name, { target: { value: "Summer photos" } });
  fireEvent.blur(name);
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/images/albums/album-1",
      expect.objectContaining({ method: "PUT" }),
    ),
  );

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add image" })).not.toBeDisabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add image" }));
  const file = new File(["image"], "camp.png", { type: "image/png" });
  const input = document.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, { target: { files: [file] } });

  expect(await screen.findByRole("status", { name: "Uploading camp.png" })).toBeInTheDocument();
});
