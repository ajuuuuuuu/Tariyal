import { Facebook, Instagram, Mail, MessageCircle } from "lucide-react";

const navItems = ["Home", "Tree", "Members", "Gallery", "About Us", "Contact"];

const socialLinks = [
  { href: "#", label: "Facebook", icon: Facebook },
  { href: "#", label: "Instagram", icon: Instagram },
  { href: "https://wa.me/919999999999", label: "WhatsApp", icon: MessageCircle },
  { href: "mailto:your@email.com", label: "Email", icon: Mail },
];

export function Footer() {
  return (
    <footer className="relative w-full bg-[#faf7f2] pt-0 sm:pt-0 -mt-24 sm:-mt-28 ">
      <div className="relative">
        <div className="h-[2px] w-full bg-[#d4af37]" />

        <div className="absolute left-1/2 -top-[31px] -translate-x-1/2">
          <div className="relative">
            
            <svg
              className="absolute right-full top-1/2 -translate-y-1/2 -mr-3"
              xmlns="http://www.w3.org/2000/svg"
              width="80"
              height="28"
              viewBox="0 0 100 40"
              fill="none"
            >
              <path d="M0 20H95" stroke="#D4AF37" strokeWidth="3" />
              <path d="M0 20C17 5 37 5 42 20C47 35 67 35 84 20" stroke="#D4AF37" strokeWidth="2" />
              <circle cx="0" cy="20" r="4" fill="#D4AF37" />
              <circle cx="95" cy="20" r="4" fill="#D4AF37" />
            </svg>

            {/* <svg
              className="absolute right-full top-1/2 -translate-y-1/2 -mr-2"
              xmlns="http://www.w3.org/2000/svg"
              width="66"
              height="28"
              viewBox="0 0 94 40"
              fill="none"
            >
              <path d="M0 20H84" stroke="#D4AF37" strokeWidth="2" />
              <path d="M0 20C15 32 35 32 40 20C45 8 58 8 66 20" stroke="#D4AF37" strokeWidth="2" />
            </svg> */}

            <svg
              className="absolute left-full top-1/2 -translate-y-1/2 -ml-3"
              xmlns="http://www.w3.org/2000/svg"
              width="80"
              height="28"
              viewBox="0 0 100 40"
              fill="none"
            >
              <path d="M5 20H100" stroke="#D4AF37" strokeWidth="3" />
              <path d="M13 20C30 35 50 35 55 20C60 5 80 5 97 20" stroke="#D4AF37" strokeWidth="2" />
              <circle cx="5" cy="20" r="4" fill="#D4AF37" />
              <circle cx="100" cy="20" r="4" fill="#D4AF37" />
            </svg>

            {/* <svg
              className="absolute left-full top-1/2 -translate-y-1/2 -ml-2"
              xmlns="http://www.w3.org/2000/svg"
              width="66"
              height="28"
              viewBox="0 0 94 40"
              fill="none"
            >
              <path d="M0 20C15 8 35 8 40 20C45 32 58 32 66 20" stroke="#D4AF37" strokeWidth="3" />
            </svg> */}

            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#d4af37] bg-gradient-to-b from-[#09224c] to-[#061226] shadow-2xl">
              <img
                src="/logo-tree.png"
                alt="Tariyal tree logo"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#071329] via-[#0a2855] to-[#0c6388]">
        <div className="mx-auto max-w-[1800px]">
          <div className="hidden h-[52px] items-center justify-between px-6 lg:flex">
            <div className="flex items-center gap-2">
              <img src="/crown.png" alt="Tariyal logo" className="w-8" />

              <div className="ml-2">
                <h2 className="font-serif text-[16px] leading-none text-[#e7c978]">TARIYAL</h2>
                <p className="text-[10px] tracking-wider text-[#e7c978]">VANSH | VANSHAWALI</p>
              </div>
            </div>

            <div className="h-12 w-px bg-[#8e7740]" />

            <nav>
              <ul className="flex items-center gap-4">
                {navItems.map((item) => (
                  <li key={item}>
                    <a
                      href="/"
                      className="text-[15px] font-medium text-[#efd28b] duration-300 hover:text-white"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="h-12 w-px bg-[#8e7740]" />

            <div className="flex items-center gap-2">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d4af37] text-[#d4af37] transition-all duration-300 hover:bg-[#d4af37] hover:text-[#0b1f45]"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>

            <div className="h-12 w-px bg-[#8e7740]" />

            <div className="text-right">
              <h3 className="text-sm font-semibold text-[#e7c978]">© 2026 Tariyal Vansh</h3>
              <p className="mt-1 text-xs text-[#d9c07b]">Preserving our heritage with pride.</p>
            </div>
          </div>

          <div className="px-4 pb-1 pt-3 lg:hidden">
            <div className="flex flex-col items-center gap-1">
              <h2 className="font-serif text-sm text-[#e7c978]">TARIYAL</h2>
              <p className="text-[9px] tracking-widest text-[#e7c978]">VANSH | VANSHAWALI</p>
              <div className="grid w-full grid-cols-2 gap-x-2 gap-y-1 text-center text-[9px]">
                {navItems.map((item) => (
                  <a
                    key={item}
                    href="/"
                    className="text-[9px] text-[#e7c978] transition hover:text-white"
                  >
                    {item}
                  </a>
                ))}
              </div>
              <div className="mb-1 flex gap-2">
                {socialLinks.map(({ href, label, icon: Icon }) => (
                  <a key={label} href={href} aria-label={label} className="text-[#d4af37]">
                    <Icon size={12} />
                  </a>
                ))}
              </div>
              <p className="text-center text-xs text-[#d4af37]">© 2026 Tariyal Vansh</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
