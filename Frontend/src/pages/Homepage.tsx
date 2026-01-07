import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { SEO } from "../components/ui/SEO";

const KEY_POINTS = [
  {
    title: "Role-based access",
    desc: "Permissions are enforced by the backend for every request, keeping data and actions controlled by user roles.",
  },
  {
    title: "Clear workflow",
    desc: "Users report time → admins review and validate → output is prepared for customers and accounting.",
  },
  {
    title: "Fortnox integration",
    desc: "Connects to Fortnox API to synchronize customer data and support real-world accounting workflows.",
  },
  {
    title: "PDF worklogs",
    desc: "Generate clean PDFs for sharing and archiving, designed for business communication.",
  },
  {
    title: "Multi-user support",
    desc: "Built to handle multiple users simultaneously with a structured, scalable backend design.",
  },
  {
    title: "Responsive & accessible",
    desc: "Optimized for mobile and desktop with accessibility and Lighthouse performance in mind.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Users report time",
    desc: "Register daily/monthly work with a fast and structured flow, including drafts and reusable templates.",
  },
  {
    n: "2",
    title: "Admins review & validate",
    desc: "Admins verify entries, manage users/customers, and keep reporting consistent and correct.",
  },
  {
    n: "3",
    title: "Customer-ready output",
    desc: "Generate worklog PDFs and keep customer data synced via Fortnox integration.",
  },
];

export const Homepage = () => {
  return (
    <main className="min-h-screen bg-(--color-background) text-(--color-foreground)">
      <SEO
        title="TimeCore — Time reporting with admin review and Fortnox integration"
        description="TimeCore is a web-based time reporting system with role-based access, admin review flow, PDF worklogs, and Fortnox integration."
        canonical="https://timecore.dynamicbranch.com/"
        themeColor="#0b1220"
        ogImage="https://timecore.dynamicbranch.com/assets/logo-PIUkv6sD.png"
      />
   

 

      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16">
  <div className="grid items-center gap-10 md:grid-cols-2">
    <div>
      <p className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs opacity-90">
        Time reporting • Admin review • Fortnox • PDF worklogs
      </p>

      <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
        A modern time reporting system built for real workflows.
      </h1>


      <p className="mt-4 text-base opacity-85 md:text-lg">
        TimeCore helps teams register work, validate reports through an admin flow,
        and prepare customer-ready output — with Fortnox integration and PDF generation.
      </p>



      <div className="mt-6 flex gap-3">
        <Button asChild className="button-85">
          <Link to="/create-account">Create account</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/login">Log in</Link>
        </Button>
      </div>
      <div className="mt-6 text-sm opacity-80">
        Built with React + Vite frontend, Node.js backend, and a relational database with
        backend-enforced permissions.
      </div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-(--color-card) p-3 shadow-sm">
      <video
        className="aspect-video w-full rounded-xl"
        controls
        playsInline
        muted
        preload="metadata"
        poster="/media/TimeCore-demo-poster.png"
      >
        <source src="/media/TimeCore-demo.mp4" type="video/mp4" />
      </video>
    </div>
  </div>
</section>


      <section className="mx-auto w-full max-w-6xl px-4 pb-6">
        <div className="rounded-2xl border border-white/10 bg-(--color-background-lighter) p-6 md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">What is TimeCore?</h2>
          <p className="mt-3 max-w-3xl text-sm opacity-85 md:text-base">
            TimeCore is a web-based system designed for structured time reporting and administrative review.
            The platform separates user and admin responsibilities, and every request is validated by the backend
            to ensure correct permissions, data integrity, and a scalable architecture.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold md:text-3xl">How it works</h2>
        <p className="mt-2 max-w-2xl opacity-85">
          A simple flow designed to match real business routines.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-(--color-card) p-5">
              <div className="text-sm opacity-70">Step {s.n}</div>
              <div className="mt-1 font-medium">{s.title}</div>
              <div className="mt-2 text-sm opacity-85">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 " id="features">
        <h2 className="text-2xl font-semibold md:text-3xl">Key features</h2>
        <p className="mt-2 max-w-2xl opacity-85">
          Focused on security, clarity, and reliable administration.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ">
          {KEY_POINTS.map((f) => (
            <Card key={f.title} className="rounded-2xl border-white/10 bg-red-200 pt-5 pb-5">
              <CardHeader>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm opacity-85">{f.desc}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="rounded-2xl border border-white/10 bg-(--color-card) p-6 md:p-10">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-xl font-semibold">Ready to see the flow?</h3>
              <p className="mt-1 text-sm opacity-85">
                Create an account and explore time reporting, admin review, and PDF output.
              </p>
            </div>
            <Button asChild className="button-85">
              <Link to="/register">Create account</Link>
            </Button>
          </div>
        </div>

      </section>
    </main>
  );
}
