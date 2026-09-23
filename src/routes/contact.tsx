import { createFileRoute } from "@tanstack/react-router";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui-kit";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Support — Cricket Auction Pro" },
      { name: "description", content: "Talk to the Cricket Auction Pro support team by phone, WhatsApp or email." },
      { property: "og:title", content: "Contact Support — Cricket Auction Pro" },
      { property: "og:description", content: "Support for tournament setup, payments and live auctions." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <AppShell>
      <h1 className="mb-4 font-display text-3xl font-bold">Contact us</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <Phone className="mb-3 size-6 text-accent" />
          <p className="font-bold">Call support</p>
          <a className="text-sm text-muted-foreground" href="tel:9422115394">9422115394</a>
        </Card>
        <Card>
          <MessageCircle className="mb-3 size-6 text-accent" />
          <p className="font-bold">WhatsApp</p>
          <a className="text-sm text-muted-foreground" href="https://wa.me/919422115394" target="_blank" rel="noreferrer">
            Chat with us
          </a>
        </Card>
        <Card>
          <Mail className="mb-3 size-6 text-accent" />
          <p className="font-bold">Email</p>
          <a className="text-sm text-muted-foreground" href="mailto:ritesshhh19@gmail.com">ritesshhh19@gmail.com</a>
        </Card>
      </div>
    </AppShell>
  );
}
