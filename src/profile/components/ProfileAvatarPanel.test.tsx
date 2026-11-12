import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import ProfileAvatarPanel from "./ProfileAvatarPanel";

const props = {
  avatarPanelWidth: "20rem",
  avatarLoaded: true,
  avatars: [],
  isEditable: true,
  initials: "AA",
  t: (_id: string, message: string) => message,
};

test("an owner without a profile photo can open the upload picker and select a file", () => {
  const upload = jest.fn();
  const openPicker = jest.fn(() => document.getElementById("avatarUploadInput")?.click());
  render(<ProfileAvatarPanel {...props} onOpenFilePicker={openPicker} onUploadChange={upload} />);
  const input = document.getElementById("avatarUploadInput")!;
  const click = jest.spyOn(input, "click");

  expect(screen.getByText("AA")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
  expect(openPicker).toHaveBeenCalledTimes(1);
  expect(click).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { files: [new File(["photo"], "avatar.png", { type: "image/png" })] } });
  expect(upload).toHaveBeenCalledTimes(1);
});

test("a profile photo exposes replace, and removing it restores upload", () => {
  const replace = jest.fn();
  const photo = { id: "avatar-1", url: "/avatar.png" };
  const view = render(<ProfileAvatarPanel {...props} avatars={[photo]} onReplaceImage={replace} onOpenFilePicker={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Upload image" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Replace image" }));
  expect(replace).toHaveBeenCalledWith(expect.objectContaining({ id: photo.id }));

  view.rerender(<ProfileAvatarPanel {...props} onOpenFilePicker={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Upload image" })).toBeInTheDocument();
});

test("visitors and profiles still loading do not offer an upload picker", () => {
  const view = render(<ProfileAvatarPanel {...props} isEditable={false} onOpenFilePicker={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Upload image" })).not.toBeInTheDocument();
  expect(document.getElementById("avatarUploadInput")).not.toBeInTheDocument();

  view.rerender(<ProfileAvatarPanel {...props} avatarLoaded={false} onOpenFilePicker={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Upload image" })).not.toBeInTheDocument();
});

test("upload and replacement controls are disabled during a profile upload", () => {
  const openPicker = jest.fn();
  const view = render(<ProfileAvatarPanel {...props} avatarUploadStatus="uploading" onOpenFilePicker={openPicker} />);
  expect(screen.getByRole("button", { name: "Upload image" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
  expect(openPicker).not.toHaveBeenCalled();

  view.rerender(<ProfileAvatarPanel {...props} avatars={[{ id: "avatar-1", url: "/avatar.png" }]} avatarUploadStatus="uploading" />);
  expect(screen.getByRole("button", { name: "Replace image" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Delete image" })).toBeDisabled();
});
