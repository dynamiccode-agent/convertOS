"use client";

import { SignInPage, Testimonial } from "@/components/ui/sign-in";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const sampleTestimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
    name: "Sarah Chen",
    handle: "@sarahdigital",
    text: "ConvertOS transformed our Meta Ads ROI. The intelligence layer is game-changing."
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
    name: "Marcus Johnson",
    handle: "@marcustech",
    text: "Best Meta Ads dashboard I've used. Clean, fast, and actionable insights."
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "David Martinez",
    handle: "@davidcreates",
    text: "From chaos to clarity. ConvertOS made our ad spend decisions data-driven."
  },
];

export default function SignInPageRoute() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { data: session, status } = useSession();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-700 dark:text-gray-300">Loading...</span>
        </div>
      </div>
    );
  }

  // If authenticated, don't render signin form (will redirect via useEffect)
  if (status === "authenticated") {
    return null;
  }

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else if (result?.ok) {
        router.push("/dashboard");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="bg-background text-foreground">
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}
      <SignInPage
        heroImageSrc="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=2160&q=80"
        testimonials={sampleTestimonials}
        onSignIn={handleSignIn}
      />
    </div>
  );
}
