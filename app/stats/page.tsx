"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { statsApi, CountEntry } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, Building2, Tag, BookMarked, Star, FileText, BarChart2, ChevronDown, ChevronRight } from "lucide-react";

export default function StatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => statsApi.get(),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Lade Statistiken…</p>;
  }

  if (!stats) {
    return <p className="text-muted-foreground">Keine Daten verfügbar.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Statistik</h1>
        <p className="text-muted-foreground text-sm mt-1">Übersicht über deine Bibliothek</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Bücher gesamt" value={stats.totalBooks} />
        <StatCard icon={BookMarked} label="Gelesen" value={stats.booksRead} />
        <StatCard icon={Users} label="Autoren" value={stats.totalAuthors} />
        <StatCard icon={Building2} label="Verlage" value={stats.totalPublishers} />
        <StatCard icon={Tag} label="Kategorien" value={stats.totalCategories} />
        <StatCard icon={FileText} label="Leseeinträge" value={stats.totalReadingRecords} />
        <StatCard
          icon={Star}
          label="Ø Bewertung"
          value={
            stats.averageRating != null
              ? `${stats.averageRating.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} / 10`
              : "–"
          }
        />
        <StatCard
          icon={BarChart2}
          label="Ø Seitenzahl"
          value={stats.averagePageCount != null ? Math.round(stats.averagePageCount) : "–"}
        />
      </div>

      {/* Charts: simple bar charts using CSS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarChart
          title="Bücher nach Kategorie"
          data={stats.booksByCategory}
        />
        <BarChart
          title="Bücher nach Sprache"
          data={stats.booksByLanguage}
        />
        <BarChart
          title="Bücher nach Bewertung"
          data={stats.booksByRating.map((e) => ({
            label: `${e.label} ★`,
            count: e.count,
          }))}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function BarChart({
  title,
  data,
}: {
  title: string;
  data: CountEntry[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">Keine Daten</p>
        ) : (
          <div className="space-y-2">
            {data.map((item) => {
              const hasChildren = (item.children ?? []).length > 0;
              const isExpanded = !!expanded[item.label];
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [item.label]: !isExpanded }))
                        }
                        className="flex items-center gap-1 truncate max-w-[70%] hover:text-primary transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ) : (
                      <span className="truncate max-w-[70%]">{item.label}</span>
                    )}
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(item.count / max) * 100}%` }}
                    />
                  </div>
                  {hasChildren && isExpanded && (
                    <div className="pl-5 pt-1 space-y-1">
                      {item.children!.map((child) => (
                        <div key={child.label} className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[70%]">{child.label}</span>
                            <span className="font-medium">{child.count}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60 transition-all"
                              style={{ width: `${(child.count / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
