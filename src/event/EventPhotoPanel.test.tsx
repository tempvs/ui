import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import EventPhotoPanel from "./EventPhotoPanel";
import { deleteEventImage, getEventImages, uploadEventImage } from "./eventApi";

jest.mock("./eventApi", () => ({
  deleteEventImage: jest.fn(),
  getEventImages: jest.fn(),
  uploadEventImage: jest.fn(),
}));

const getImages = getEventImages as jest.MockedFunction<typeof getEventImages>;
const upload = uploadEventImage as jest.MockedFunction<typeof uploadEventImage>;
const remove = deleteEventImage as jest.MockedFunction<typeof deleteEventImage>;
const photo = { id: "event-photo", url: "/event.png" };

beforeEach(() => {
  jest.resetAllMocks();
  getImages.mockResolvedValue([]);
});

test("an empty event offers upload, disables it while saving, then offers replace and delete", async () => {
  let finishUpload!: (value: typeof photo) => void;
  upload.mockImplementation(() => new Promise(resolve => { finishUpload = resolve; }));
  render(<EventPhotoPanel eventId="event-1" name="Festival" editable />);
  await waitFor(() => expect(getImages).toHaveBeenCalledWith("event-1"));
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const openPicker = jest.spyOn(input, "click");
  fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
  expect(openPicker).toHaveBeenCalledTimes(1);
  const file = new File(["photo"], "event.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });

  expect(upload).toHaveBeenCalledWith("event-1", file, undefined);
  expect(screen.getByRole("button", { name: "Upload image" })).toBeDisabled();
  finishUpload(photo);
  await waitFor(() => expect(screen.getByRole("button", { name: "Replace image" })).toBeEnabled());
  expect(screen.queryByRole("button", { name: "Upload image" })).not.toBeInTheDocument();

  remove.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Delete image" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Upload image" })).toBeEnabled());
  expect(remove).toHaveBeenCalledWith("event-1", photo.id);
});

test.each([{ photos: [], state: "empty" }, { photos: [photo], state: "populated" }])("event visitors cannot upload or replace photos when $state", async ({ photos }) => {
  getImages.mockResolvedValue(photos);
  render(<EventPhotoPanel eventId="event-1" name="Festival" editable={false} />);
  await waitFor(() => expect(getImages).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: /Upload image|Replace image|Delete image/ })).not.toBeInTheDocument();
  expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
});
