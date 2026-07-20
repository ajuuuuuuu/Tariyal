import { useRouterState } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, MessageCircle, Shield, Crown } from "lucide-react";


const navItems = ["Home", "Tree", "Members", "Gallery", "About Us", "Contact"];

const socialLinks = [
  { href: "#", label: "Facebook", icon: Facebook },
  { href: "#", label: "Instagram", icon: Instagram },
  { href: "https://wa.me/918864860736", label: "WhatsApp", icon: MessageCircle },
  { href: "mailto:adrashtariyal124@email.com", label: "Email", icon: Mail },
];

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/auth") return null;

  return (
    <footer className="relative w-full shrink-0 bg-transparent">
      {/* Gold divider with centered emblem */}
      <div className="relative">
        <div className="h-[2px] w-full bg-[#d4af37]" />

        <div className="pointer-events-none absolute left-1/2 -top-[38px] -translate-x-1/2">
          <div className="relative flex items-center">
            {/* Left flourish */}
            <svg
              className="mr-2"
              xmlns="http://www.w3.org/2000/svg"
              width="90"
              height="30"
              viewBox="0 0 100 40"
              fill="none"
            >
              <path d="M0 20H95" stroke="#D4AF37" strokeWidth="2" />
              <path d="M5 20C22 5 42 5 47 20C52 35 72 35 89 20" stroke="#D4AF37" strokeWidth="1.5" />
              <circle cx="2" cy="20" r="3" fill="#D4AF37" />
              <circle cx="95" cy="20" r="3" fill="#D4AF37" />
            </svg>

            {/* Center emblem */}
            <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-2 border-[#d4af37] bg-gradient-to-b from-[#09224c] to-[#061226] shadow-2xl">
              <img
                src="/logo-tree.png"
                alt="Tariyal tree logo"
                className="h-[70%] w-[70%] object-contain"
              />
            </div>

            {/* Right flourish */}
            <svg
              className="ml-2"
              xmlns="http://www.w3.org/2000/svg"
              width="90"
              height="30"
              viewBox="0 0 100 40"
              fill="none"
            >
              <path d="M5 20H100" stroke="#D4AF37" strokeWidth="2" />
              <path d="M11 20C28 35 48 35 53 20C58 5 78 5 95 20" stroke="#D4AF37" strokeWidth="1.5" />
              <circle cx="5" cy="20" r="3" fill="#D4AF37" />
              <circle cx="98" cy="20" r="3" fill="#D4AF37" />
            </svg>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="bg-gradient-to-r from-[#071329] via-[#0a2855] to-[#0c6388]">
        <div className="mx-auto max-w-[1800px]">
          {/* Desktop */}
          <div className="hidden h-[48px] items-center justify-between gap-4 px-6 lg:flex">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-10 items-center justify-center">
                <Shield className="absolute inset-0 h-full w-full text-[#d4af37]" strokeWidth={1.5} />
                <Crown className="relative h-4 w-4 text-[#d4af37]" />
              </div>
              <div>
                <h2 className="font-serif text-[18px] leading-none tracking-wider text-[#e7c978]">
                  TARIYAL
                </h2>
                <p className="mt-1 text-[10px] tracking-[0.2em] text-[#e7c978]">
                  VANSH | VANSHAWALI
                </p>
              </div>
            </div>

            <nav>
              <ul className="flex items-center">
                {navItems.map((item, i) => (
                  <li key={item} className="flex items-center">
                    <a
                      href="/"
                      className="px-4 text-[15px] font-medium text-[#efd28b] transition-colors duration-300 hover:text-white"
                    >
                      {item}
                    </a>
                    {i < navItems.length - 1 && (
                      <span className="text-[#8e7740]">|</span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center gap-2">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d4af37] text-[#d4af37] transition-all duration-300 hover:bg-[#d4af37] hover:text-[#0b1f45]"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>

            <div className="text-right">
              <h3 className="text-[13px] font-semibold text-[#e7c978]">
                © 2025 Tariyal Vansh Vanshawali
              </h3>
              <p className="mt-1 text-[11px] italic text-[#d9c07b]">All rights reserved.</p>
            </div>
          </div>

          {/* Mobile / Tablet */}
          <div className="flex h-[48px] items-center justify-between gap-3 px-3 lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative flex h-7 w-6 shrink-0 items-center justify-center">
                <Shield className="absolute inset-0 h-full w-full text-[#d4af37]" strokeWidth={1.5} />
                <Crown className="relative h-3 w-3 text-[#d4af37]" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-serif text-[11px] leading-none tracking-wider text-[#e7c978]">
                  TARIYAL
                </h2>
                <p className="mt-0.5 truncate text-[8px] tracking-[0.2em] text-[#e7c978]">
                  VANSH | VANSHAWALI
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d4af37] text-[#d4af37]"
                >
                  <Icon size={10} />
                </a>
              ))}
            </div>

            <p className="shrink-0 text-right text-[9px] leading-tight text-[#e7c978]">
              © 2025 Tariyal<br />
              <span className="italic text-[#d9c07b]">All rights reserved.</span>
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
