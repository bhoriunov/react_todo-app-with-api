import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from '../src/components/Header';
import { TodoList } from '../src/components/TodoList';
import { Footer } from '../src/components/Footer';
import { getTodos, USER_ID } from './api/todos';
import { Todo } from './types/Todo';
import { UserWarning } from './UserWarning';
import { Filter } from './types/Filter';
import { client } from './utils/fetchClient';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(Filter.All);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [loadingIds, setLoadingIds] = useState<number[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [todos, error]);

  useEffect(() => {
    const fetchTodos = async () => {
      setError(null);

      try {
        const fetchedTodos = await getTodos();

        setTodos(fetchedTodos);
      } catch {
        setError('Unable to load todos');
      }
    };

    fetchTodos();
  }, []);

  useEffect((): void => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [error]);

  const getFilteredTodos = useCallback(() => {
    return todos.filter(todo => {
      switch (filter) {
        case Filter.Active:
          return !todo.completed;
        case Filter.Completed:
          return todo.completed;
        default:
          return true;
      }
    });
  }, [todos, filter]);

  const filteredTodos = getFilteredTodos();

  const startEditing = (todoId: number) => {
    setEditingTodoId(todoId);
    setEditedTitle(todos.find(todo => todo.id === todoId)?.title || '');
  };

  const handleAddTodo = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!newTodo.trim()) {
        setError('Title should not be empty');
        inputRef.current?.focus();

        return;
      }

      const tempId = Date.now();
      const tempTodoItem: Todo = {
        id: tempId,
        title: newTodo.trim(),
        completed: false,
        userId: USER_ID,
      };

      setTempTodo(tempTodoItem);
      setIsLoading(true);

      try {
        const newTodoData = await client.post<Todo>('/todos', {
          title: tempTodoItem.title,
          userId: tempTodoItem.userId,
          completed: tempTodoItem.completed,
        });

        setTodos(prev => [...prev, newTodoData]);
        setNewTodo('');
        if (inputRef.current) {
          inputRef.current.focus();
        }
      } catch {
        setError('Unable to add a todo');
      } finally {
        setTempTodo(null);
        setIsLoading(false);
      }
    },
    [newTodo],
  );

  const handleDeleteTodo = async (todoId: number) => {
    setLoadingIds(prev => [...prev, todoId]);

    try {
      await client.delete(`/todos/${todoId}`);
      setTodos(prev => prev.filter(todo => todo.id !== todoId));

      inputRef.current?.focus();
    } catch {
      setError('Unable to delete a todo');
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== todoId));
    }
  };

  const handleClearCompleted = async () => {
    const completedTodos = todos.filter(todo => todo.completed);

    setLoadingIds(completedTodos.map(todo => todo.id));

    try {
      const results = await Promise.allSettled(
        completedTodos.map(todo => client.delete(`/todos/${todo.id}`)),
      );

      const successfulIds = completedTodos
        .filter((_, index) => results[index].status === 'fulfilled')
        .map(todo => todo.id);

      setTodos(prevTodos =>
        prevTodos.filter(todo => !successfulIds.includes(todo.id)),
      );

      if (results.some(result => result.status === 'rejected')) {
        setError('Unable to delete a todo');
      }
    } catch {
      setError('Unable to clear completed todos');
    } finally {
      setLoadingIds([]);

      inputRef.current?.focus();
    }
  };

  const handleToggleAll = async () => {
    const shouldCompleteAll = todos.some(todo => !todo.completed);
    const todosToToggle = todos.filter(
      todo => todo.completed !== shouldCompleteAll,
    );

    setLoadingIds(todosToToggle.map(todo => todo.id));

    try {
      const results = await Promise.allSettled(
        todosToToggle.map(todo =>
          client.patch(`/todos/${todo.id}`, { completed: shouldCompleteAll }),
        ),
      );

      const successfulIds = todosToToggle
        .filter((_, index) => results[index].status === 'fulfilled')
        .map(todo => todo.id);

      setTodos(prev =>
        prev.map(todo =>
          successfulIds.includes(todo.id)
            ? { ...todo, completed: shouldCompleteAll }
            : todo,
        ),
      );

      if (results.some(result => result.status === 'rejected')) {
        setError('Unable to update a todo');
      }
    } catch {
      setError('Unable to toggle all todos');
    } finally {
      setLoadingIds([]);
    }
  };

  const handleUpdateTodo = async (todoId: number, newTitle: string) => {
    if (!newTitle.trim()) {
      setError('Title should not be empty');

      return;
    }

    if (newTitle === todos.find(todo => todo.id === todoId)?.title) {
      setEditingTodoId(null);

      return;
    }

    setLoadingIds(prev => [...prev, todoId]);

    try {
      const updatedTodo = await client.patch<Todo>(`/todos/${todoId}`, {
        title: newTitle,
      });

      setTodos(prev =>
        prev.map(todo => (todo.id === todoId ? updatedTodo : todo)),
      );
      setEditingTodoId(null);
    } catch {
      setError('Unable to update a todo');
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== todoId));
    }
  };

  const handleCancelRename = () => {
    setEditingTodoId(null);
  };

  const handleToggleStatus = async (todoId: number, completed: boolean) => {
    setLoadingIds(prev => [...prev, todoId]);

    try {
      const updatedTodo = await client.patch<Todo>(`/todos/${todoId}`, {
        completed,
      });

      setTodos(prev =>
        prev.map(todo => (todo.id === todoId ? updatedTodo : todo)),
      );
    } catch {
      setError('Unable to update a todo');
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== todoId));
    }
  };

  const completedTodosCount = todos.filter(todo => todo.completed).length;
  const activeTodosCount = todos.filter(todo => !todo.completed).length;

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <Header
          newTodo={newTodo}
          setNewTodo={setNewTodo}
          handleAddTodo={handleAddTodo}
          isLoading={isLoading}
          inputRef={inputRef}
          handleToggleAll={handleToggleAll}
          todos={todos}
        />

        <TodoList
          todos={filteredTodos}
          tempTodo={tempTodo}
          loadingIds={loadingIds}
          editingId={editingTodoId}
          handleDeleteTodo={handleDeleteTodo}
          handleUpdateTodo={handleUpdateTodo}
          startEditing={startEditing}
          handleCancelRename={handleCancelRename}
          handleToggleStatus={handleToggleStatus}
        />

        {todos.length > 0 && (
          <Footer
            filter={filter}
            setFilter={setFilter}
            activeTodosCount={activeTodosCount}
            completedTodosCount={completedTodosCount}
            handleClearCompleted={handleClearCompleted}
          />
        )}
      </div>
      <div
        data-cy="ErrorNotification"
        className={`notification is-danger is-light has-text-weight-normal ${
          error ? '' : 'hidden'
        }`}
      >
        <button
          type="button"
          className="delete"
          data-cy="HideErrorButton"
          onClick={() => setError(null)}
        />
        {error || ''}
      </div>
    </div>
  );
};
