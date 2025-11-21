import { BarChart3, FileText, Users, Settings } from "lucide-react";

export const navItems = [
    { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
    { href: "/faculty/create_test", label: "Create Test", icon: <FileText className="w-5 h-5" /> },
    { href: "/faculty/view_test", label: "View Test", icon: <FileText className="w-5 h-5" /> },
    { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
    { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
];