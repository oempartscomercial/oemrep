import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Em construção — chega nos próximos épicos.
        </p>
      </CardContent>
    </Card>
  );
}
