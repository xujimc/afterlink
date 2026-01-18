"use client";

import { useState } from "react";

interface ArticleGateProps {
  onSubmit: (data: {
    name: string;
    preference: "email" | "phone";
    value: string;
  }) => void;
  isSubmitting: boolean;
}

export function ArticleGate({ onSubmit, isSubmitting }: ArticleGateProps) {
  const [name, setName] = useState("");
  const [preference, setPreference] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string) => {
    // Basic phone validation - at least 10 digits
    return /^\+?[\d\s\-()]{10,}$/.test(phone);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { name?: string; contact?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Please enter your name";
    }

    if (!contactValue.trim()) {
      newErrors.contact = `Please enter your ${preference}`;
    } else if (preference === "email" && !validateEmail(contactValue)) {
      newErrors.contact = "Please enter a valid email address";
    } else if (preference === "phone" && !validatePhone(contactValue)) {
      newErrors.contact = "Please enter a valid phone number";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit({ name: name.trim(), preference, value: contactValue.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fadeIn">
        <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">
          Before you read...
        </h2>
        <p className="text-[var(--muted)] mb-6">
          Enter your details to access this article.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Your name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC017] ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="John Doe"
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Contact preference radio */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Preferred contact method
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="preference"
                  value="email"
                  checked={preference === "email"}
                  onChange={() => {
                    setPreference("email");
                    setContactValue("");
                    setErrors({});
                  }}
                  className="mr-2 accent-[#FFC017]"
                  disabled={isSubmitting}
                />
                <span className="text-[var(--foreground)]">Email</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="preference"
                  value="phone"
                  checked={preference === "phone"}
                  onChange={() => {
                    setPreference("phone");
                    setContactValue("");
                    setErrors({});
                  }}
                  className="mr-2 accent-[#FFC017]"
                  disabled={isSubmitting}
                />
                <span className="text-[var(--foreground)]">Phone</span>
              </label>
            </div>
          </div>

          {/* Contact value field */}
          <div>
            <label
              htmlFor="contact"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              {preference === "email" ? "Email address" : "Phone number"}
            </label>
            <input
              type={preference === "email" ? "email" : "tel"}
              id="contact"
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC017] ${
                errors.contact ? "border-red-500" : "border-gray-300"
              }`}
              placeholder={
                preference === "email" ? "john@example.com" : "+1 (555) 123-4567"
              }
              disabled={isSubmitting}
            />
            {errors.contact && (
              <p className="text-red-500 text-sm mt-1">{errors.contact}</p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#FFC017] text-black hover:bg-[#e6ac14]"
            }`}
          >
            {isSubmitting ? "Please wait..." : "Continue to article"}
          </button>
        </form>
      </div>
    </div>
  );
}
