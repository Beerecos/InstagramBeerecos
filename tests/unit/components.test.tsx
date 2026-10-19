// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FunnelChart } from "@/components/ui/funnel-chart";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";

afterEach(cleanup);

describe("design system", () => {
  it("StatusBadge écrit toujours le libellé (jamais la couleur seule)", () => {
    render(<StatusBadge status="not_configured" />);
    expect(screen.getByText("À configurer")).toBeTruthy();
  });

  it("MetricCard distingue « non disponible » de zéro", () => {
    render(<><MetricCard label="Visites" value={null} /><MetricCard label="Leads" value={0} /></>);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("FunnelChart expose un tableau accessible avec les taux", () => {
    render(<FunnelChart title="Tunnel" stages={[{ key: "a", label: "Leads", value: 20 }, { key: "b", label: "Visites", value: 5 }]} />);
    const table = screen.getByRole("table", { name: "Tunnel" });
    expect(within(table).getByText("Visites")).toBeTruthy();
    expect(within(table).getByText("5")).toBeTruthy();
  });
});
