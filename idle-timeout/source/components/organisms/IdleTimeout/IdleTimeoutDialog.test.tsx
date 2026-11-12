import {fireEvent, render, screen} from "@testing-library/react";
import {IdleTimeoutDialog} from "./IdleTimeoutDialog";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | {defaultValue?: string; minutes?: number}) => {
      if (typeof options === "string") {
        return options;
      }
      return (options?.defaultValue ?? key).replace("{{minutes}}", String(options?.minutes ?? ""));
    },
  }),
}));

describe("IdleTimeoutDialog", () => {
  it("shows the logout message and an OK button", () => {
    render(<IdleTimeoutDialog open isLoggingOut={false} onConfirm={jest.fn()} />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Session timed out")).toBeInTheDocument();
    expect(screen.getByText(/inactive for 15 minutes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "OK"})).toBeEnabled();
  });

  it("calls onConfirm when OK is clicked", () => {
    const onConfirm = jest.fn();
    render(<IdleTimeoutDialog open isLoggingOut={false} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", {name: "OK"}));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not close when Escape is pressed", () => {
    render(<IdleTimeoutDialog open isLoggingOut={false} onConfirm={jest.fn()} />);

    fireEvent.keyDown(screen.getByRole("alertdialog"), {key: "Escape"});

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("disables OK while logging out", () => {
    render(<IdleTimeoutDialog open isLoggingOut onConfirm={jest.fn()} />);

    expect(screen.getByRole("button", {name: "OK"})).toBeDisabled();
  });

  it("shows nothing when closed", () => {
    render(<IdleTimeoutDialog open={false} isLoggingOut={false} onConfirm={jest.fn()} />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
