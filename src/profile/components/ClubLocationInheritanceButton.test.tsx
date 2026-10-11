import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClubLocationInheritanceButton from "./ClubLocationInheritanceButton";
import { getProfileClubs } from "../../club/clubApi";

jest.mock("../../club/clubApi", () => ({ getProfileClubs: jest.fn() }));

const getClubs = jest.mocked(getProfileClubs);
const club = (id: string, name: string) => ({
  id,
  name,
  locationPlaceId: `place-${id}`,
  location: `${name} place`,
});

afterEach(() => jest.resetAllMocks());

test("does not render an inheritance action without club membership", async () => {
  getClubs.mockResolvedValue([] as never);
  render(<ClubLocationInheritanceButton profileId="profile-1" onSelect={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText("Inherit club location")).not.toBeInTheDocument());
});

test("uses the only available club without opening a modal", async () => {
  const onSelect = jest.fn();
  getClubs.mockResolvedValue([club("1", "First club")] as never);
  render(<ClubLocationInheritanceButton profileId="profile-1" onSelect={onSelect} />);
  const button = await screen.findByRole("button", { name: "Inherit club location" });
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  expect(screen.queryByText("Choose a club location")).not.toBeInTheDocument();
});

test("asks the owner to choose when several clubs have locations", async () => {
  const onSelect = jest.fn();
  getClubs.mockResolvedValue([club("1", "First club"), club("2", "Second club")] as never);
  render(<ClubLocationInheritanceButton profileId="profile-1" onSelect={onSelect} />);
  fireEvent.click(await screen.findByRole("button", { name: "Inherit club location" }));
  fireEvent.click(screen.getByRole("button", { name: /Second club/ }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }));
});
