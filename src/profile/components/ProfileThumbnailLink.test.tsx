import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ProfileThumbnailLink from "./ProfileThumbnailLink";

test("links to a profile alias with an avatar thumbnail", () => {
  const { container } = render(
    <MemoryRouter>
      <ProfileThumbnailLink
        profile={{
          id: "profile-uuid",
          name: "Example Company",
          alias: "example-company",
          avatarUrl: "/avatar.jpg",
        }}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Example Company" })).toHaveAttribute(
    "href",
    "/profile/example-company",
  );
  expect(container.querySelector("img")).toHaveAttribute("src", "/avatar.jpg");
});
