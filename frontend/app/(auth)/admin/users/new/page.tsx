"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { AdminRole } from "@/lib/types/user";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([AdminRole.STAFF, AdminRole.MANAGER, AdminRole.ADMIN], {
    message: "Role is required",
  }),
});

type FormData = z.infer<typeof schema>;

const rolePermissions = [
  { role: "Staff", desc: "View orders, manage table status, limited menu access." },
  { role: "Manager", desc: "All Staff permissions + manage menu items and view reports." },
  { role: "Admin", desc: "All Manager permissions + manage users and system settings." },
];

export default function CreateUserPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => adminApi.createUser(data),
    onSuccess: () => {
      alert("User created successfully!");
      router.push("/admin/users");
    },
    onError: (err: any) => {
      alert(err?.message ?? "Failed to create user.");
    },
  });

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Create Admin User</h1>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Username</label>
          <input
            {...register("username")}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            {...register("email")}
            type="email"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <div className="relative mt-1">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Role</label>
          <select
            {...register("role")}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a role</option>
            <option value={AdminRole.STAFF}>Staff</option>
            <option value={AdminRole.MANAGER}>Manager</option>
            <option value={AdminRole.ADMIN}>Admin</option>
          </select>
          {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role.message}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Creating..." : "Create User"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/users")}
            className="rounded-lg border px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="rounded-xl border bg-gray-50 p-5">
        <h2 className="mb-3 font-semibold text-gray-700">Role Permissions</h2>
        <ul className="space-y-2">
          {rolePermissions.map(({ role, desc }) => (
            <li key={role}>
              <span className="font-medium text-gray-800">{role}: </span>
              <span className="text-sm text-gray-600">{desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
