import {useState} from 'react';
import {PencilSimpleIcon} from '@phosphor-icons/react';
import {normalizeFileName} from '../geometry/serialization';

export function FileName({name, onChange}: {readonly name: string; readonly onChange: (name: string) => void}) {
    const [editing, setEditing] = useState(false),
        [draft, setDraft] = useState(name);

    function save() {
        onChange(normalizeFileName(draft));
        setEditing(false);
    }

    return <div className="file-name">
        {editing ? <form onSubmit={event => {
            event.preventDefault();
            save();
        }}>
            <input type="text" aria-label="Nazwa pliku" value={draft} maxLength={120} autoFocus
                   onFocus={event => event.currentTarget.select()}
                   onChange={event => setDraft(event.target.value)} onBlur={save}
                   onKeyDown={event => {
                       if (event.key === 'Escape') {
                           event.preventDefault();
                           event.stopPropagation();
                           setEditing(false);
                       }
                   }}/>
        </form> : <button className="file-name-button" title="Edytuj nazwę pliku" aria-label={`Edytuj nazwę pliku: ${name}`}
                          onClick={() => {
                              setDraft(name);
                              setEditing(true);
                          }}>
            <span className="file-name-value">{name}</span>
            <span className="file-name-edit"><PencilSimpleIcon size={12}/> Edytuj</span>
        </button>}
    </div>;
}
