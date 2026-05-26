"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Task = {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const fetchTasks = async () => {
    const res = await fetch(`${API_URL}/tasks/`);
    const data = await res.json();
    setTasks(data);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/tasks/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: description || null }),
    });
    setTitle("");
    setDescription("");
    fetchTasks();
  };

  const toggleTask = async (task: Task) => {
    await fetch(`${API_URL}/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await fetch(`${API_URL}/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Gillilab Starter</h1>
        <p className="text-gray-400 text-sm mb-8">Next.js 15 + FastAPI + SQLite 풀스택 데모</p>

        {/* 할 일 추가 폼 */}
        <form
          onSubmit={createTask}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          <h2 className="text-base font-semibold text-gray-700 mb-4">새 할 일 추가</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="제목 *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              추가
            </button>
          </div>
        </form>

        {/* 할 일 목록 */}
        <div className="space-y-3">
          {tasks.length === 0 && (
            <p className="text-center text-gray-400 py-10 text-sm">
              할 일이 없습니다. 추가해보세요!
            </p>
          )}
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-start gap-3"
            >
              <button
                onClick={() => toggleTask(task)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  task.completed
                    ? "bg-green-500 border-green-500"
                    : "border-gray-300 hover:border-blue-400"
                }`}
              >
                {task.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                aria-label="삭제"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
